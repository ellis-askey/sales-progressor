import { prisma } from "@/lib/prisma";
import { extractPostcode } from "@/lib/services/property-intel";
import { sendEmail } from "@/lib/email";
import { pushToContact, pushToTransaction, pushToUser } from "@/lib/services/push";
import { getMilestoneCopy, buildGreeting, type MilestoneEmailCopy, type RecipientEmailCopy } from "@/lib/portal-copy";
// ── Model B (composition) integration — no-op until EMAIL_SKELETON_MODE=on ──
//
// When the feature flag is enabled AND the milestoneCode has a registered
// skeleton, the recipient copy is assembled from Section[] sources via
// the email-assembler. Otherwise the legacy emailCopy fires unchanged.
//
// Default (flag unset / not "on") behaviour: zero call to the assembler,
// zero schema lookups beyond the existing path, zero observable change.
// Confirmed by the resolveRecipientCopy helper below — if shape is null
// (which it is when the flag is off), the function returns the legacy
// emailCopy entry directly with no detour.
import { SKELETON_REGISTRY, isSkeletonModeEnabled } from "@/lib/email-skeletons/registry";
import { assembleEmail, type FileShape, type ConfirmerRoute, type HandoffDirection } from "@/lib/email-assembler";
import { BILATERAL_PAIR_OF, HANDOFF_DEFAULT_ACTOR, computeBilateralSuppressedRecipient } from "@/lib/email-skeletons/journey-order";
import { extractFirstName } from "@/lib/contacts/displayName";
import { completeMilestone } from "@/lib/services/milestones";
import { notifyPortalMilestoneConfirmed, notifyOutsourcedMilestoneConfirmed } from "@/lib/services/notifications";
import { maybeFireFirstExchangeEmail } from "@/lib/services/retention";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { PORTAL_AGENT_ONLY_CODES } from "@/lib/chase/portal-agent-only-codes";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";

export type PortalMilestone = {
  id: string;
  code: string;
  name: string;
  side: string;
  orderIndex: number;
  blocksExchange: boolean;
  weight: number;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
  eventDate: Date | null;
  completedAt: Date | null;
  confirmedByPortal: boolean;
  eventDateRequired: boolean;
};

export type PortalUpdate = {
  id: string;
  content: string;
  createdAt: Date;
  method: string | null;
};

async function logAutomatedEmail(
  transactionId: string,
  contactIds: string[],
  subject: string,
  bodyPlain: string,
): Promise<void> {
  const stripped = bodyPlain
    .split("\n")
    .filter((line) => !line.includes("/portal/"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "outbound",
      method: "email",
      isAutomated: true,
      contactIds,
      content: `Subject: ${subject}\n\n${stripped}`,
      createdById: null,
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) await prisma.$connect();
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConnErr = msg.includes("Can't reach database") || msg.includes("Connection refused") || msg.includes("ECONNREFUSED") || msg.includes("ConnectionReset") || msg.includes("forcibly closed") || msg.includes("10054");
      if (!isConnErr || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

export async function getPortalData(token: string) {
  return withRetry(async () => {
    const contact = await prisma.contact.findUnique({
      where: { portalToken: token },
      select: { id: true, name: true, roleType: true, propertyTransactionId: true },
    });
    if (!contact) return null;

    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: contact.propertyTransactionId },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        purchasePrice: true,
        tenure: true,
        purchaseType: true,
        expectedExchangeDate: true,
        completionDate: true,
        createdAt: true,
        overridePredictedDate: true,
        agency: { select: { name: true } },
      },
    });
    if (!tx) return null;

    const postcode = extractPostcode(tx.propertyAddress);

    return {
      contact,
      transaction: {
        id: tx.id,
        propertyAddress: tx.propertyAddress,
        status: tx.status,
        purchasePrice: tx.purchasePrice,
        tenure: tx.tenure,
        purchaseType: tx.purchaseType,
        expectedExchangeDate: tx.expectedExchangeDate,
        completionDate: tx.completionDate,
        agencyName: tx.agency?.name ?? "",
        postcode,
        createdAt: tx.createdAt,
        overridePredictedDate: tx.overridePredictedDate,
      },
    };
  });
}

export async function getPortalMilestones(
  transactionId: string,
  side: "vendor" | "purchaser"
): Promise<PortalMilestone[]> {
  return withRetry(async () => {
    const defs = await prisma.milestoneDefinition.findMany({
      where: { side },
      orderBy: { orderIndex: "asc" },
    });

    const completions = await prisma.milestoneCompletion.findMany({
      where: { transactionId },
    });

    const completionMap = new Map(completions.map((c) => [c.milestoneDefinitionId, c]));

    return defs.map((def) => {
      const comp = completionMap.get(def.id) ?? null;
      const state = comp?.state ?? "locked";
      const isComplete = state === "complete";
      const isNotRequired = state === "not_required";
      const isAvailable = state === "available" || isComplete || isNotRequired;

      return {
        id: def.id,
        code: def.code,
        name: def.name,
        side: def.side,
        orderIndex: def.orderIndex,
        blocksExchange: def.blocksExchange,
        weight: Number(def.weight),
        isComplete,
        isNotRequired,
        isAvailable,
        eventDate: comp?.eventDate ?? null,
        completedAt: comp?.completedAt ?? null,
        confirmedByPortal: comp?.confirmedByPortal ?? false,
        eventDateRequired: def.eventDateRequired,
      };
    });
  });
}

export async function logPortalView(token: string): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      roleType: true,
      propertyTransactionId: true,
      transaction: {
        select: {
          propertyAddress: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!contact) return;

  const tx = contact.transaction;
  const content = `${contact.name} (${contact.roleType}) viewed their client portal for ${tx.propertyAddress}`;

  // Log as internal note — use system user id or assigned user id
  const userId = tx.assignedUser?.id;
  if (!userId) return;

  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [contact.id],
      content,
      createdById: userId,
    },
  });
  // No email — the portal bell on the dashboard handles this notification
}

// B1 of the client-chase arc (Sub-arc B) — hard-block on client portal
// confirmation of the six bilateral / agent-only milestone codes. The codes
// themselves live in lib/chase/portal-agent-only-codes.ts (imported above)
// so the same set drives both this server enforcement and the client-side
// button stripping in PortalMilestoneList.tsx.
//
// Sentinel error message: the action wrapper (portalConfirmMilestoneAction)
// intercepts this string and returns a structured response to the UI so the
// bottom-sheet renders graceful explanatory copy instead of a generic 500.
export const PORTAL_AGENT_ONLY_ERROR = "AGENT_ONLY_MILESTONE";

// Client portal milestone confirmation — A1 of the client-chase arc.
//
// Delegates to completeMilestone() with a Contact confirmer so the full
// in-service cascade fires uniformly (touchLastActivity, summaryText,
// outOfOrderCompletion self-resolve, chain-mate notifications, celebration,
// dependent unlocks, reminder auto-resolve, exchange-gate check).
// The whole write is atomic via $transaction, matching the agent path.
//
// B1 of Sub-arc B added a hard-block at the top of this function for the
// six bilateral / agent-only milestone codes (VM18/PM25, VM19/PM26,
// VM20/PM27). See PORTAL_AGENT_ONLY_CODES above.
//
// Post-transaction this function then fires:
//   - bilateral counterpart (VM19↔PM26, VM20↔PM27) — exchange/completion
//     are single real-world events that mark both sides simultaneously
//   - expectedExchangeDate / completionDate sync on the transaction row
//   - PostHog MILESTONE_CONFIRMED event (tagged confirmedBy: "client")
//   - pushToTransaction (other portal contacts get a web-push)
//   - maybeFireFirstExchangeEmail (keyed to file's agentUserId, not the
//     confirming contact)
//   - notifyOutsourcedMilestoneConfirmed (SP gets pinged on outsourced files)
//   - logPortalMilestoneConfirm (PRESERVED — internal note + rich emails to
//     the other contacts on the file)
//   - sendExchangeCompletionPack (PRESERVED — for VM19/PM26 only)
//
// confirmedByPortal: true is set inside completeMilestone (driven by the
// Contact confirmer). completedById remains null (the FK targets User).
export async function portalCompleteMilestone(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const def = await prisma.milestoneDefinition.findFirst({
    where: { id: input.milestoneDefinitionId, side },
  });
  if (!def) throw new Error("Milestone not found");

  // B1 hard-block: clients cannot self-confirm the six bilateral / agent-
  // only codes. Defence in depth — even if the portal UI fails to strip the
  // Confirm button, a crafted POST to portalConfirmMilestoneAction still
  // can't push these codes to complete. The action wrapper catches this
  // exact error string and returns a structured response so the UI renders
  // a graceful message rather than a generic 500.
  if (PORTAL_AGENT_ONLY_CODES.has(def.code)) {
    throw new Error(PORTAL_AGENT_ONLY_ERROR);
  }

  // Milestone must be in available state to be confirmed via portal
  const current = await prisma.milestoneCompletion.findUnique({
    where: {
      transactionId_milestoneDefinitionId: {
        transactionId: contact.propertyTransactionId,
        milestoneDefinitionId: input.milestoneDefinitionId,
      },
    },
    select: { state: true },
  });
  if (!current || (current.state !== "available" && current.state !== "complete")) {
    throw new Error("Milestone not yet available for confirmation");
  }

  // Resolve bilateral counterpart before opening the transaction (read-only lookup).
  const BILATERAL_PAIRS: Record<string, string> = {
    VM19: "PM26", PM26: "VM19",
    VM20: "PM27", PM27: "VM20",
  };
  const counterCode = BILATERAL_PAIRS[def.code];
  let counterDefId: string | undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id;
  }

  const confirmer = { kind: "contact" as const, id: contact.id, name: contact.name };

  // Atomic primary + bilateral counterpart + exchange-date sync
  const completion = await prisma.$transaction(async (ptx) => {
    const primary = await completeMilestone({
      transactionId: contact.propertyTransactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      confirmer,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    }, ptx);

    if (counterDefId) {
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: { transactionId: contact.propertyTransactionId, milestoneDefinitionId: counterDefId, state: "complete" },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: contact.propertyTransactionId,
          milestoneDefinitionId: counterDefId,
          confirmer,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        }, ptx);
      }
    }

    // Exchange Forecast sync — lock in the confirmed exchange date
    if ((def.code === "VM19" || def.code === "PM26") && input.eventDate) {
      await ptx.propertyTransaction.update({
        where: { id: contact.propertyTransactionId },
        data: { expectedExchangeDate: new Date(input.eventDate) },
      });
    }

    return primary;
  });

  // Completion-date sync (matches agent action, post-transaction)
  if ((def.code === "VM20" || def.code === "PM27") && input.eventDate) {
    const actualDate = new Date(input.eventDate);
    const txData = await prisma.propertyTransaction.findFirst({
      where: { id: contact.propertyTransactionId },
      select: { completionDate: true },
    });
    const existingDate = txData?.completionDate;
    const dateMismatch = !existingDate ||
      Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000;
    if (dateMismatch) {
      await prisma.propertyTransaction.update({
        where: { id: contact.propertyTransactionId },
        data: { completionDate: actualDate },
      });
    }
  }

  // Lookup the file's agent / SP / serviceType for the post-cascade dispatchers.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { agentUserId: true, assignedUserId: true, serviceType: true, agencyId: true },
  });

  // PostHog event (tagged confirmedBy: "client"). Keyed to the file's agent,
  // not the confirming contact — Contact.id wouldn't make sense as a PostHog
  // distinct_id.
  if (tx?.agentUserId) {
    void trackServerEvent(tx.agentUserId, ANALYTICS_EVENTS.MILESTONE_CONFIRMED, {
      transactionId: contact.propertyTransactionId,
      milestoneId: input.milestoneDefinitionId,
      milestoneCode: def.code,
      agencyId: tx.agencyId || undefined,
      confirmedBy: "client",
      confirmerContactId: contact.id,
    });
  }

  // Web push to other portal contacts subscribed to this transaction.
  // Same title/body logic as the agent action.
  const label = getMilestoneCopy(def.code).label;
  const short = (await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { propertyAddress: true },
  }))?.propertyAddress.split(",")[0] ?? "Your file";
  // Unified exchange / completion / ready-to-exchange strings — matches
  // confirmMilestoneAction and confirmExchangeReconciliationAction.
  let pushTitle = "One step closer";
  let pushBody = `${label}, done at ${short}.`;
  if (def.code === "VM19" || def.code === "PM26") {
    pushTitle = "Contracts exchanged!";
    pushBody = `${short}. The sale is now legally binding. Congratulations.`;
  } else if (def.code === "VM20" || def.code === "PM27") {
    pushTitle = "It's completed!";
    pushBody = `${short} is yours. Congratulations on your move.`;
  } else if (def.code === "VM18" || def.code === "PM25") {
    pushTitle = "Ready to exchange";
    pushBody = `Everything's in place at ${short}. Exchange is next.`;
  } else if (input.eventDate) {
    const fmtDate = new Date(input.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    pushTitle = `Date confirmed: ${short}`;
    pushBody = `${label} booked for ${fmtDate}`;
  }
  pushToTransaction(contact.propertyTransactionId, {
    title: pushTitle,
    body: pushBody,
    urlPath: "/progress",
  }).catch(() => {});

  // First-exchange retention email — fires for the file's agent, not the
  // confirming contact (the retention reward goes to the agent for whom this
  // is their first exchange in the system).
  if ((def.code === "VM19" || def.code === "PM26") && tx?.agentUserId) {
    maybeFireFirstExchangeEmail(tx.agentUserId, contact.propertyTransactionId).catch(() => {});
  }

  // Outsourced-SP notification — clients are never the SP, so any client
  // confirm on an outsourced file pings the assigned progressor.
  if (tx?.serviceType === "outsourced" && tx.assignedUserId) {
    notifyOutsourcedMilestoneConfirmed({
      spUserId: tx.assignedUserId,
      transactionId: contact.propertyTransactionId,
      confirmerName: contact.name,
      milestoneLabel: label,
      milestoneCode: def.code,
    }).catch(() => {});
  }

  // Existing portal-specific notifications preserved exactly as before.
  logPortalMilestoneConfirm(
    contact.propertyTransactionId,
    contact.id,
    contact.name,
    def.name,
    def.code,
    input.eventDate ?? null
  ).catch(() => {});

  if (def.code === "VM19" || def.code === "PM26") {
    sendExchangeCompletionPack(contact.propertyTransactionId).catch(() => {});
  }

  return completion;
}

export async function logPortalMilestoneConfirm(
  transactionId: string,
  contactId: string,
  contactName: string,
  milestoneLabel: string,
  milestoneCode?: string,
  eventDate?: string | null
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      serviceType: true,
      // tenure + purchaseType added 2026-05-27 for Model B skeleton mode.
      // Used by resolveRecipientCopy via the FileShape construction below.
      // Nullable on the schema; null short-circuits the assembler path.
      tenure: true,
      purchaseType: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      agentUser: { select: { id: true, name: true, email: true } },
      contacts: {
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return;

  // Use client-facing portal copy label for all client communications
  const portalLabel = milestoneCode ? (getMilestoneCopy(milestoneCode).label ?? milestoneLabel) : milestoneLabel;

  // ── Model B FileShape — for the client-portal-confirmed email pipeline ──
  //
  // The client confirmed via their portal. Route is always "client_portal"
  // on this path (only clients reach logPortalMilestoneConfirm). Direction
  // is computed from whether the bilateral counterpart is already complete.
  //
  // Strict no-op when EMAIL_SKELETON_MODE is off OR tenure/purchaseType
  // are null on the tx — fileShape stays null and resolveRecipientCopy
  // falls through to legacy emailCopy[recipientKey] for every recipient.
  const portalCounterpartComplete = milestoneCode
    ? await isBilateralCounterpartComplete(transactionId, milestoneCode)
    : false;
  const portalDirection = milestoneCode
    ? computeHandoffDirection(milestoneCode, portalCounterpartComplete)
    : undefined;
  const portalFileShape: FileShape | null =
    isSkeletonModeEnabled() && tx.tenure && tx.purchaseType
      ? {
          tenure: tx.tenure,
          purchaseType: tx.purchaseType,
          route: "client_portal",
          direction: portalDirection,
        }
      : null;

  const content = `${contactName} confirmed "${milestoneLabel}" via the client portal`;

  const createdById = tx.assignedUser?.id ?? tx.agentUser?.id;
  if (createdById) {
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "internal_note",
        contactIds: [contactId],
        content,
        createdById,
      },
    });
  }

  // Structured notification for the file-owner's bell. Additive — the
  // OutboundMessage above still feeds the activity timeline. Fires for
  // BOTH outsourced (assignedUser) and self-managed (agentUser) files —
  // before this generalisation, the bell only rang on outsourced files
  // and self-managed agents had to spot client confirms in the activity
  // feed manually. Now they ring for whoever owns the file.
  const bellUserId = tx.assignedUser?.id ?? tx.agentUser?.id;
  if (bellUserId) {
    const contact = tx.contacts.find((c) => c.id === contactId);
    notifyPortalMilestoneConfirmed({
      userId: bellUserId,
      transactionId,
      contactName,
      contactRole: contact?.roleType ?? "contact",
      milestoneLabel,
      milestoneCode: milestoneCode ?? "",
    }).catch(() => {});
  }

  const base = process.env.NEXTAUTH_URL ?? "";
  const address = tx.propertyAddress;
  const serviceType     = tx.serviceType ?? undefined;
  const progressorName  = tx.assignedUser?.name  ?? "Your sales progressor";
  const progressorEmail = tx.assignedUser?.email ?? "";
  const replyTo = serviceType === "self_managed"
    ? (tx.agentUser?.email ?? undefined)
    : (tx.assignedUser?.email ?? undefined);
  const dashUrl = `${base}/transactions/${transactionId}`;

  // Per-user opt-outs for both EMAIL (default ON) and PUSH (default OFF) on
  // client milestone confirmations. Bell still fires unconditionally above.
  const agentRecipientIds = [tx.assignedUser?.id, tx.agentUser?.id].filter((x): x is string => !!x);
  const prefsByUser = agentRecipientIds.length > 0
    ? await getNotificationPrefsForUsers(agentRecipientIds)
    : new Map();
  const wantsEmail = (userId: string | undefined) =>
    userId ? prefsByUser.get(userId)?.clientConfirmationEmails !== false : false;

  // Push to the file owner (assignedUser ?? agentUser). Default OFF — agent
  // opts in from settings. The bell entry above runs unconditionally so opt-out
  // users still see it on their next SP visit.
  if (bellUserId && prefsByUser.get(bellUserId)?.push?.clientConfirmation === true) {
    const shortAddress = address.split(",")[0];
    // portalLabel is the shorter portal-copy label computed earlier from
    // getMilestoneCopy(milestoneCode).label; falls back to milestoneLabel
    // (MilestoneDefinition.name) when no portal copy exists for the code.
    pushToUser(bellUserId, {
      title: `${contactName} confirmed: ${portalLabel}`,
      body:  shortAddress,
      url:   dashUrl,
    }).catch(() => {});
  }

  // Notify the assigned progressor (outsourced only — self-managed has no assignedUser)
  if (tx.assignedUser?.email && wantsEmail(tx.assignedUser.id)) {
    sendEmail({
      to: tx.assignedUser.email,
      subject: `Client confirmed: "${milestoneLabel}" — ${tx.propertyAddress}`,
      replyTo,
      text: [
        `Hi ${extractFirstName(tx.assignedUser.name)},`,
        "",
        `${contactName} has just confirmed "${milestoneLabel}" on ${tx.propertyAddress} via their portal.`,
        "",
        `View file: ${dashUrl}`,
      ].join("\n"),
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 20px;font-size:15px">Hi ${extractFirstName(tx.assignedUser.name)},</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px">
  <p style="margin:0 0 4px;font-size:13px;color:#8b91a3">${tx.propertyAddress}</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#1a1d29">${contactName} confirmed "${milestoneLabel}"</p>
</div>
<p><a href="${dashUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View file</a></p>
</body></html>`,
    }).catch(() => {});
  }

  const confirmingContact = tx.contacts.find((c) => c.id === contactId);
  const confirmingRole = confirmingContact?.roleType;

  const richCopy = milestoneCode ? getMilestoneCopy(milestoneCode).emailCopy : null;

  if (richCopy) {
    // Compute event-date vars for portal-confirmed milestones (same logic as sendRichMilestoneEmails)
    const formattedPortalEventDate = eventDate
      ? new Date(eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : null;
    const portalEventDateVar = formattedPortalEventDate ? ` — ${formattedPortalEventDate}` : "";
    const portalEventDateClause = formattedPortalEventDate
      ? `booked for ${formattedPortalEventDate}`
      : milestoneCode === "PM6" ? "a desktop valuation (no physical visit required)" : "";
    const isPortalDesktop = milestoneCode === "PM6" && !formattedPortalEventDate;
    const purchaserPhysicalNote = (milestoneCode === "PM6" && !isPortalDesktop)
      ? " Their primary concern is that it's worth enough to secure their loan — it's not a structural survey and won't flag problems with the condition of the property."
      : "";
    const vendorVisitNote = milestoneCode === "PM6"
      ? isPortalDesktop
        ? " No physical visit to the property is needed — the assessment is conducted remotely."
        : " A surveyor acting for the lender will visit to value the property — access has been arranged, so nothing else for you to do right now."
      : "";
    const portalVars = { address, eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote };

    // Use the same per-recipient rich emails as the admin-confirmation flow.
    // This sends the correct copy to both sides — vendor gets their copy, purchaser gets theirs.
    //
    // ── Model B switch (2026-05-27): use resolveRecipientCopy so the
    // assembler fires when EMAIL_SKELETON_MODE is on AND the milestone
    // has a registered skeleton AND tenure+purchaseType are set. The
    // client_portal route variant of bilateral acted-side bodies (the ψ
    // menu — "Thanks — your solicitor's…", "You've just confirmed…",
    // etc.) is ONLY reachable via this path, so without this swap, that
    // entire route variant set is unreachable in production.
    const sideLog = new Map<"vendor" | "purchaser", { ids: string[]; subject: string; text: string }>();
    for (const c of tx.contacts) {
      if (!c.email || !c.portalToken) continue;
      const recipientKey = c.roleType as "vendor" | "purchaser";
      const copy = milestoneCode
        ? resolveRecipientCopy(milestoneCode, recipientKey, richCopy, portalFileShape)
        : richCopy[recipientKey];
      if (!copy) continue;
      const greeting  = buildGreeting(c.name);
      const portalUrl = `${base}/portal/${c.portalToken}/progress`;
      const html      = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: portalUrl, progressorName, progressorEmail, serviceType, extraVars: { eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote } });
      const subject   = interpolate(copy.subject, portalVars);
      const text      = [greeting, "", interpolate(copy.opening, portalVars), "", interpolate(copy.whatHappened, portalVars), ...(copy.whatNext ? ["", interpolate(copy.whatNext, portalVars)] : []), "", `${copy.action ?? "View your portal"}: ${portalUrl}`].join("\n");
      sendEmail({ to: c.email, subject, html, text, replyTo }).catch(() => {});
      const existing = sideLog.get(recipientKey);
      if (existing) { existing.ids.push(c.id); } else { sideLog.set(recipientKey, { ids: [c.id], subject, text }); }
    }
    for (const { ids, subject, text } of sideLog.values()) {
      logAutomatedEmail(transactionId, ids, subject, text).catch(() => {});
    }

    // Agent notification for portal-confirmed milestones (no self-confirmation suppression for portal)
    const agentCopy = richCopy.vendorAgentPortal ?? richCopy.vendorAgent;
    if (tx.agentUser?.email && agentCopy && wantsEmail(tx.agentUser.id)) {
      const greeting = buildGreeting(tx.agentUser.name);
      const subject  = interpolate(agentCopy.subject, portalVars);
      const text     = [greeting, "", interpolate(agentCopy.whatHappened, portalVars)].join("\n");
      const html     = richMilestoneEmailHtml({ greeting, copy: agentCopy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: false, serviceType, extraVars: { eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote } });
      sendEmail({ to: tx.agentUser.email, subject, html, text, replyTo }).catch(() => {});
    }
  } else {
    // Fallback for milestones without structured emailCopy: generic thank-you to confirming
    // contact and generic progress update to the other side.
    if (confirmingContact?.email && confirmingContact.portalToken) {
      const portalUrl = `${base}/portal/${confirmingContact.portalToken}`;
      const confirmSubject = `Step confirmed — ${address}`;
      const confirmText = [
        buildGreeting(confirmingContact.name),
        ``,
        `Thanks for confirming the following step on your ${confirmingRole === "vendor" ? "sale" : "purchase"} at ${address}:`,
        ``,
        `  ✓ ${portalLabel}`,
        ``,
        `Your conveyancing is moving forward. We'll be in touch when there's something new to update you on.`,
        ``,
        `View your portal: ${portalUrl}`,
      ].join("\n");
      sendEmail({
        to: confirmingContact.email,
        subject: confirmSubject,
        text: confirmText,
        replyTo,
        html: portalStepConfirmedHtml({
          firstName: extractFirstName(confirmingContact.name),
          address,
          saleWord: confirmingRole === "vendor" ? "sale" : "purchase",
          stepLabel: portalLabel,
          portalUrl,
        }),
      }).catch(() => {});
      logAutomatedEmail(transactionId, [confirmingContact.id], confirmSubject, confirmText).catch(() => {});
    }

    const otherSideRole = confirmingRole === "vendor" ? "purchaser" : "vendor";
    const otherContacts = tx.contacts.filter(
      (c) => c.id !== contactId && c.roleType === otherSideRole && c.email && c.portalToken
    );
    const otherIds: string[] = [];
    for (const other of otherContacts) {
      const portalUrl = `${base}/portal/${other.portalToken!}`;
      const otherText = [
        buildGreeting(other.name),
        ``,
        `There's been a progress update on your ${otherSideRole === "vendor" ? "sale" : "purchase"} at ${address}. Log in to see the latest.`,
        ``,
        `View your portal: ${portalUrl}`,
      ].join("\n");
      sendEmail({
        to: other.email!,
        subject: `Progress update — ${address}`,
        text: otherText,
        replyTo,
        html: portalEmailHtml({
          greeting: buildGreeting(other.name),
          body: `There's been a progress update on your ${otherSideRole === "vendor" ? "sale" : "purchase"} at <strong>${address}</strong>. Log in to your portal to see the latest.`,
          ctaText: "View your portal",
          ctaUrl: portalUrl,
        }),
      }).catch(() => {});
      otherIds.push(other.id);
    }
    if (otherIds.length > 0) {
      logAutomatedEmail(transactionId, otherIds, `Progress update — ${address}`, `There's been a progress update on your ${otherSideRole === "vendor" ? "sale" : "purchase"} at ${address}. Log in to see the latest.`).catch(() => {});
    }
  }

  // Push notifications — build milestone-specific messages
  const short = tx.propertyAddress.split(",")[0];
  const isExchange   = milestoneCode === "VM19" || milestoneCode === "PM26";
  const isCompletion = milestoneCode === "VM20" || milestoneCode === "PM27";
  const isReadyToExchange = milestoneCode === "VM18" || milestoneCode === "PM25";

  // Confirming-contact fallback keeps a personal "thanks" voice; other-
  // contacts fallback uses the more neutral "one step closer" frame. The
  // exchange / completion / ready-to-exchange / date-confirmed branches all
  // unify with the agent-flow strings per Flag 2 of the voice-check doc.
  let confirmTitle = "Thanks, that's confirmed";
  let confirmBody  = `Your ${confirmingRole === "vendor" ? "sale" : "purchase"} just moved a step forward.`;
  let otherTitle   = "One step closer";
  let otherBody    = `Your move just progressed. Tap to see the latest.`;

  if (isExchange) {
    confirmTitle = "Contracts exchanged!";
    confirmBody  = `${short}. The sale is now legally binding. Congratulations.`;
    otherTitle   = "Contracts exchanged!";
    otherBody    = `${short}. The sale is now legally binding. Congratulations.`;
  } else if (isCompletion) {
    confirmTitle = "It's completed!";
    confirmBody  = `${short} is yours. Congratulations on your move.`;
    otherTitle   = "It's completed!";
    otherBody    = `${short} is yours. Congratulations on your move.`;
  } else if (isReadyToExchange) {
    confirmTitle = "Ready to exchange";
    confirmBody  = `Everything's in place at ${short}. Exchange is next.`;
    otherTitle   = "Ready to exchange";
    otherBody    = `Everything's in place at ${short}. Exchange is next.`;
  } else if (eventDate) {
    const fmtDate = new Date(eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    confirmTitle = `Date confirmed: ${short}`;
    confirmBody  = `${milestoneLabel} booked for ${fmtDate}`;
    otherTitle   = `Date confirmed: ${short}`;
    otherBody    = `${milestoneLabel} booked for ${fmtDate}`;
  }

  if (confirmingContact?.portalToken) {
    pushToContact(contactId, {
      title: confirmTitle,
      body:  confirmBody,
      url: `${base}/portal/${confirmingContact.portalToken}/progress`,
    }).catch(() => {});
  }

  const otherPushContacts = tx.contacts.filter(
    (c) => c.id !== contactId && (c.roleType === "vendor" || c.roleType === "purchaser") && c.portalToken
  );
  for (const other of otherPushContacts) {
    pushToContact(other.id, {
      title: otherTitle,
      body:  otherBody,
      url: `${base}/portal/${other.portalToken!}/progress`,
    }).catch(() => {});
  }
}

// Called from confirmMilestoneAction — emails all vendor/purchaser contacts when
// the progressor/agent confirms any milestone, regardless of which side it's on.
//
// ── Skeleton-mode parameters (added 2026-05-27) ──────────────────────────
// confirmerRoute    — derived from session.user.role at the caller via
//                     roleToConfirmerRoute(). Passes through to the
//                     assembler so bilateral acted-side route variants
//                     (client_portal / agent / sales_progressor) match
//                     correctly. Undefined for non-bilateral codes.
// handoffDirection  — computed by the caller via computeHandoffDirection()
//                     + isBilateralCounterpartComplete(). Passes through so
//                     bilateral default/inverse direction-gated bodies
//                     match correctly. Undefined for non-bilateral codes.
// Both are NO-OP when the flag is off (sendRichMilestoneEmails only uses
// them when constructing the FileShape, and shape is null when flag off).
export async function sendAdminMilestoneNotificationToPortal(
  transactionId: string,
  milestoneCode: string,
  eventDate?: string | null,
  confirmerId?: string,
  confirmerRoute?: ConfirmerRoute,
  handoffDirection?: HandoffDirection,
): Promise<void> {
  // Exchange gets the rich "what happens next" pack — delegate entirely
  if (milestoneCode === "VM19" || milestoneCode === "PM26") {
    return sendExchangeCompletionPack(transactionId, milestoneCode, confirmerId);
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      completionDate: true,
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return;

  // Use per-recipient rich email when available
  const milestoneCopy = getMilestoneCopy(milestoneCode);
  if (milestoneCopy.emailCopy) {
    await sendRichMilestoneEmails(transactionId, milestoneCode, milestoneCopy.emailCopy, confirmerId, eventDate, confirmerRoute, handoffDirection);
    return;
  }

  const base = process.env.NEXTAUTH_URL ?? "";
  const address = tx.propertyAddress;
  const portalLabel = milestoneCopy.label;
  const isCompletion = milestoneCode === "VM20" || milestoneCode === "PM27";
  const isReadyToExchange = milestoneCode === "VM18" || milestoneCode === "PM25";

  const dateStr = eventDate
    ? new Date(eventDate).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const sideLog = new Map<string, { ids: string[]; subject: string; text: string }>();

  for (const c of tx.contacts) {
    if (!c.email || !c.portalToken) continue;

    const saleWord = c.roleType === "vendor" ? "sale" : "purchase";
    const firstName = extractFirstName(c.name);
    const portalUrl = `${base}/portal/${c.portalToken}/progress`;

    let subject: string;
    let headline: string;
    let intro: string;
    let stepLabel: string | null = null;
    let stepDate: string | null = null;

    if (isCompletion) {
      const completionDateStr = tx.completionDate
        ? new Date(tx.completionDate).toLocaleDateString("en-GB", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })
        : null;
      subject = `Your ${saleWord} has completed — ${address}`;
      headline = saleWord === "sale" ? "Sale complete!" : "Purchase complete!";
      intro = `Congratulations — your ${saleWord} at <strong>${address}</strong> has completed${completionDateStr ? ` on <strong>${completionDateStr}</strong>` : ""}. The keys have been handed over and funds transferred.`;
    } else if (isReadyToExchange) {
      subject = `Ready to exchange — ${address}`;
      headline = "Ready to exchange";
      intro = `Your solicitor has confirmed everything is in place for your ${saleWord} at <strong>${address}</strong>. Exchange of contracts is imminent.`;
    } else if (dateStr) {
      subject = `Date confirmed — ${address}`;
      headline = "Date confirmed";
      intro = `A date has been confirmed for your ${saleWord} at <strong>${address}</strong>.`;
      stepLabel = portalLabel;
      stepDate = dateStr;
    } else {
      subject = `Progress update — ${address}`;
      headline = "Progress update";
      intro = `Your ${saleWord} at <strong>${address}</strong> is moving forward.`;
      stepLabel = portalLabel;
    }

    const html = portalProgressEmailHtml({ firstName, address, headline, intro, stepLabel, stepDate, portalUrl });
    const lines = [`Hi ${firstName},`, "", intro.replace(/<[^>]+>/g, ""), ""];
    if (stepLabel) lines.push(`  ✓ ${stepLabel}${stepDate ? ` — ${stepDate}` : ""}`, "");
    lines.push(`View your portal: ${portalUrl}`);

    sendEmail({ to: c.email, subject, text: lines.join("\n"), html }).catch(() => {});

    // Track per-role for activity log (first contact per role provides the representative body)
    const roleKey = c.roleType === "vendor" ? "vendor" : "purchaser";
    const existing = sideLog.get(roleKey);
    if (existing) {
      existing.ids.push(c.id);
    } else {
      sideLog.set(roleKey, { ids: [c.id], subject, text: lines.join("\n") });
    }
  }

  for (const { ids, subject, text } of sideLog.values()) {
    logAutomatedEmail(transactionId, ids, subject, text).catch(() => {});
  }
}

function portalProgressEmailHtml({ firstName, address, headline, intro, stepLabel, stepDate, portalUrl }: {
  firstName: string; address: string; headline: string; intro: string;
  stepLabel: string | null; stepDate: string | null; portalUrl: string;
}) {
  const stepBlock = stepLabel ? `
  <div style="margin:0 0 24px;padding:14px 18px;background:#F0FDF4;border-left:3px solid #10B981;border-radius:8px">
    <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#10B981">Step completed</p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1d29">${stepLabel}</p>
    ${stepDate ? `<p style="margin:4px 0 0;font-size:13px;color:#4a5162">${stepDate}</p>` : ""}
  </div>` : "";

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${address}</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">${headline}</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 20px;font-size:15px">Hi ${firstName},</p>
  <p style="margin:0 0 ${stepLabel ? "20px" : "28px"};font-size:14px;line-height:1.6;color:#4a5162">${intro}</p>
  ${stepBlock}
  <p style="margin:0 0 24px">
    <a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View your portal</a>
  </p>
  <p style="margin:0;font-size:12px;color:#8b91a3">If you have any questions, please contact your sales progressor.</p>
</div>
</body></html>`;
}

function portalStepConfirmedHtml({ firstName, address, saleWord, stepLabel, portalUrl }: {
  firstName: string; address: string; saleWord: string; stepLabel: string; portalUrl: string;
}) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${address}</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">Step confirmed</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 20px;font-size:15px">Hi ${firstName},</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4a5162">Thanks for confirming the following step on your ${saleWord}:</p>
  <div style="margin:0 0 24px;padding:14px 18px;background:#F0FDF4;border-left:3px solid #10B981;border-radius:8px;display:flex;align-items:center;gap:12px">
    <span style="font-size:16px;color:#10B981;flex-shrink:0">✓</span>
    <span style="font-size:14px;font-weight:600;color:#1a1d29">${stepLabel}</span>
  </div>
  <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#4a5162">Your conveyancing is moving forward. We'll be in touch when there's something new to update you on.</p>
  <p style="margin:0 0 24px">
    <a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View your portal</a>
  </p>
  <p style="margin:0;font-size:12px;color:#8b91a3">If you have any questions, please contact your sales progressor.</p>
</div>
</body></html>`;
}

function portalEmailHtml({ greeting, body, ctaText, ctaUrl }: {
  greeting: string; body: string; ctaText: string; ctaUrl: string;
}) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 16px">${greeting}</p>
<p style="margin:0 0 24px;line-height:1.6;color:#4a5162">${body}</p>
<p><a href="${ctaUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${ctaText}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">If you have any questions, please contact your sales progressor.</p>
</body></html>`;
}

// ─── Rich per-recipient milestone email renderer ─────────────────────────────
// Used when a milestone has emailCopy defined. Falls back to the generic
// portalProgressEmailHtml path when emailCopy is absent.

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function richMilestoneEmailHtml({
  greeting,
  copy,
  address,
  ctaUrl,
  progressorName,
  progressorEmail,
  isProgressor = false,
  serviceType,
  whatsappNumber,
  extraVars,
}: {
  greeting: string;
  copy: RecipientEmailCopy;
  address: string;
  ctaUrl: string;
  progressorName: string;
  progressorEmail: string;
  isProgressor?: boolean;
  serviceType?: string;
  whatsappNumber?: string;
  extraVars?: Record<string, string>;
}): string {
  const vars = { address, ...extraVars };
  const ctaBg   = isProgressor ? "#3B82F6" : "#FF6B4A";
  const ctaLabel = copy.action ?? "View portal";

  const whatNextBlock = copy.whatNext
    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">${interpolate(copy.whatNext, vars)}</p>`
    : "";

  const signatureBlock = isProgressor
    ? `<p style="margin:0;font-size:12px;color:#8b91a3">Sales Progressor system — ${address}</p>`
    : serviceType === "self_managed"
      ? `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Just reply to this email.</p>`
      : whatsappNumber
        ? `<p style="margin:0 0 12px;font-size:13px;color:#4a5162">Questions? Your progressor is <strong>${progressorName}</strong>.</p>
           <a href="https://wa.me/${whatsappNumber}" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
             Message me on WhatsApp
           </a>`
        : `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Your progressor is <strong>${progressorName}</strong>.</p>`;

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${address}</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">${interpolate(copy.heroLabel, vars)}</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#1a1d29;line-height:1.5">${interpolate(copy.opening, vars)}</p>
  <p style="margin:0 0 ${copy.whatNext ? "20px" : "28px"};font-size:14px;line-height:1.7;color:#4a5162">${interpolate(copy.whatHappened, vars)}</p>
  ${whatNextBlock}
  ${copy.action ? `<p style="margin:0 0 28px"><a href="${ctaUrl}" style="display:inline-block;background:${ctaBg};color:#fff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">${ctaLabel}</a></p>` : ""}
  ${signatureBlock}
</div>
</body></html>`;
}

// ── Bilateral hand-off direction computation ────────────────────────────
//
// Given a bilateral milestone code being confirmed now, determine whether
// the pair is firing in NATURAL order (first-actor first → "default") or
// REVERSED order (second-actor first → "inverse"). Returns undefined for
// non-bilateral codes — the assembler treats undefined as "no direction
// gating applies to this body".
//
// The rule:
//   - currentIsNaturalFirst = HANDOFF_DEFAULT_ACTOR[code] matches code's V/P prefix
//   - If currentIsNaturalFirst AND counterpart NOT complete: default (we're first, natural)
//   - If currentIsNaturalFirst AND counterpart IS complete:    inverse (we're catching up)
//   - If !currentIsNaturalFirst AND counterpart NOT complete: inverse (we went first)
//   - If !currentIsNaturalFirst AND counterpart IS complete:    default (natural completion)
//
// counterpartComplete is passed in by the caller (which already has the
// MilestoneCompletion row state for the file).
export function computeHandoffDirection(
  currentCode: string,
  counterpartComplete: boolean,
): HandoffDirection | undefined {
  const pairFirstActor = HANDOFF_DEFAULT_ACTOR[currentCode];
  if (!pairFirstActor) return undefined; // not a bilateral code
  const currentActedSide: "vendor" | "purchaser" =
    currentCode.startsWith("V") ? "vendor" : "purchaser";
  const currentIsNaturalFirst = pairFirstActor === currentActedSide;
  if (currentIsNaturalFirst) {
    return counterpartComplete ? "inverse" : "default";
  }
  return counterpartComplete ? "default" : "inverse";
}

// Look up whether a bilateral milestone's counterpart is already complete.
// Returns false for non-bilateral codes (the value is unused but the call
// shape is preserved for the caller).
export async function isBilateralCounterpartComplete(
  transactionId: string,
  currentCode: string,
): Promise<boolean> {
  const counterCode = BILATERAL_PAIR_OF[currentCode];
  if (!counterCode) return false;
  const counterDef = await prisma.milestoneDefinition.findFirst({
    where: { code: counterCode },
    select: { id: true },
  });
  if (!counterDef) return false;
  const completion = await prisma.milestoneCompletion.findUnique({
    where: {
      transactionId_milestoneDefinitionId: {
        transactionId,
        milestoneDefinitionId: counterDef.id,
      },
    },
    select: { state: true },
  });
  return completion?.state === "complete";
}

// Map session.user.role → ConfirmerRoute. Used by callers of
// sendAdminMilestoneNotificationToPortal to derive the route that the
// assembler needs. The portal-confirm path passes "client_portal"
// directly (no role lookup needed — only clients reach that path).
//
// Role taxonomy (from CLAUDE.md):
//   director / negotiator / viewer       → customer agency staff → "agent"
//   sales_progressor / admin / superadmin → internal staff      → "sales_progressor"
export function roleToConfirmerRoute(
  role: string | undefined,
): ConfirmerRoute | undefined {
  if (!role) return undefined;
  if (role === "director" || role === "negotiator" || role === "viewer") {
    return "agent";
  }
  if (role === "sales_progressor" || role === "admin" || role === "superadmin") {
    return "sales_progressor";
  }
  return undefined;
}

// Builds and sends all per-recipient emails for a milestone that has emailCopy defined.
// Returns true if emails were sent, false if emailCopy is absent (caller uses fallback).
// ── Skeleton-aware recipient copy resolver (no-op when flag is off) ─────
//
// Returns either an assembled-from-skeleton RecipientEmailCopy, OR the
// legacy emailCopy entry, depending on whether:
//   1. EMAIL_SKELETON_MODE is "on" in env (flag gate)
//   2. SKELETON_REGISTRY has this milestoneCode
//   3. shape is non-null (i.e. tenure + purchaseType were set on the tx)
//
// All three must be true for the assembler path. Otherwise fall through
// to legacy. This is the load-bearing line of the no-op contract.
function resolveRecipientCopy(
  milestoneCode: string,
  recipientKey: "vendor" | "purchaser" | "vendorAgent" | "progressor",
  emailCopy: MilestoneEmailCopy,
  shape: FileShape | null,
): RecipientEmailCopy | undefined {
  if (shape) {
    const skeletonField = SKELETON_REGISTRY[milestoneCode]?.[recipientKey];
    if (skeletonField) {
      const a = assembleEmail(skeletonField, shape);
      return {
        subject:      a.subject,
        heroLabel:    a.heroLabel,
        opening:      a.opening,
        whatHappened: a.whatHappened,
        // Empty string → null so the existing truthy-check (`copy.whatNext`)
        // at line ~1047 keeps working as today (the bracket-spread expression
        // skips when whatNext is null).
        whatNext:     a.whatNext || null,
        // Empty string → null so the ?? "View your portal" fallback fires.
        action:       a.action   || null,
      };
    }
  }
  return emailCopy[recipientKey];
}

async function sendRichMilestoneEmails(
  transactionId: string,
  milestoneCode: string,
  emailCopy: MilestoneEmailCopy,
  confirmerId?: string,
  eventDate?: string | null,
  // ── Skeleton-mode plumbing (optional; no-op when flag is off) ────────
  // confirmerRoute    — bilateral acted-side route (client_portal / agent / SP)
  // handoffDirection  — bilateral hand-off direction ("default" / "inverse")
  // These two parameters are wired through so the assembler can pick the
  // right Section[] entries. Callers (confirmMilestoneAction) can leave
  // them undefined for non-bilateral milestones or until skeleton mode is
  // enabled. They have no effect when shape is null below.
  confirmerRoute?: ConfirmerRoute,
  handoffDirection?: HandoffDirection,
): Promise<boolean> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      serviceType: true,
      // tenure + purchaseType added for the skeleton-mode FileShape build.
      // Nullable on the schema; resolveRecipientCopy guards against nulls
      // by returning legacy copy when shape can't be constructed.
      tenure: true,
      purchaseType: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      agentUser: { select: { id: true, name: true, email: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return false;

  // Skeleton-mode FileShape — null when the flag is off OR when tenure/
  // purchaseType aren't both set on the tx. Null shape means
  // resolveRecipientCopy will fall through to legacy emailCopy for every
  // recipient regardless of registry contents — strict no-op.
  const fileShape: FileShape | null =
    isSkeletonModeEnabled() && tx.tenure && tx.purchaseType
      ? {
          tenure: tx.tenure,
          purchaseType: tx.purchaseType,
          route: confirmerRoute,
          direction: handoffDirection,
        }
      : null;

  const base             = process.env.NEXTAUTH_URL ?? "";
  const address          = tx.propertyAddress;
  const serviceType      = tx.serviceType ?? undefined;
  const progressorName   = tx.assignedUser?.name  ?? "Your sales progressor";
  const progressorEmail  = tx.assignedUser?.email ?? "";
  const replyTo          = serviceType === "self_managed"
    ? (tx.agentUser?.email ?? undefined)
    : (tx.assignedUser?.email ?? undefined);
  const dashUrl          = `${base}/transactions/${transactionId}`;

  // Compute event-date interpolation vars for milestones that capture a date (PM6, PM9)
  const formattedEventDate = eventDate
    ? new Date(eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  // {eventDate} — " on Monday, 7 May 2026" prefix or "" (used in PM9 opening/whatHappened)
  const eventDateVar = formattedEventDate ? ` — ${formattedEventDate}` : "";
  // {eventDateClause} — full descriptive clause for PM6 (physical vs desktop valuation)
  const eventDateClause = formattedEventDate
    ? `booked for ${formattedEventDate}`
    : milestoneCode === "PM6" ? "a desktop valuation (no physical visit required)" : "";
  const isDesktop = milestoneCode === "PM6" && !formattedEventDate;
  const purchaserPhysicalNote = (milestoneCode === "PM6" && !isDesktop)
    ? " Their primary concern is that it's worth enough to secure their loan — it's not a structural survey and won't flag problems with the condition of the property."
    : "";
  const vendorVisitNote = milestoneCode === "PM6"
    ? isDesktop
      ? " No physical visit to the property is needed — the assessment is conducted remotely."
      : " A surveyor acting for the lender will visit to value the property — access has been arranged, so nothing else for you to do right now."
    : "";

  // Bilateral pair-complete suppression. See computeBilateralSuppressedRecipient
  // for the rule. When a bilateral milestone fires in INVERSE direction,
  // the side that acted on the counterpart is suppressed — they were
  // emailed when they confirmed and must not be re-notified now.
  const suppressedRecipient = computeBilateralSuppressedRecipient(milestoneCode, handoffDirection);

  // Vendor and purchaser contacts
  const sideLog = new Map<"vendor" | "purchaser", { ids: string[]; subject: string; text: string }>();

  for (const c of tx.contacts) {
    if (!c.email || !c.portalToken) continue;
    const recipientKey = c.roleType as "vendor" | "purchaser";
    // Skip the first-actor side on inverse-direction bilateral completions.
    if (suppressedRecipient && recipientKey === suppressedRecipient) continue;
    const copy = resolveRecipientCopy(milestoneCode, recipientKey, emailCopy, fileShape);
    if (!copy) continue;

    const greeting = buildGreeting(c.name);
    const vars     = { address, eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote };
    const portalUrl = `${base}/portal/${c.portalToken}/progress`;

    const html = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: portalUrl, progressorName, progressorEmail, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote } });
    const subject = interpolate(copy.subject, vars);
    const text = [greeting, "", interpolate(copy.opening, vars), "", interpolate(copy.whatHappened, vars), ...(copy.whatNext ? ["", interpolate(copy.whatNext, vars)] : []), "", `${copy.action ?? "View your portal"}: ${portalUrl}`].join("\n");

    sendEmail({ to: c.email, subject, text, html, replyTo }).catch(() => {});

    const existing = sideLog.get(recipientKey);
    if (existing) {
      existing.ids.push(c.id);
    } else {
      sideLog.set(recipientKey, { ids: [c.id], subject, text });
    }
  }

  for (const { ids, subject, text } of sideLog.values()) {
    logAutomatedEmail(transactionId, ids, subject, text).catch(() => {});
  }

  // Agent notification — only on outsourced files; self-managed agents manage their own files
  const skipAgentEmail = serviceType === "self_managed";
  const vendorAgentCopy = resolveRecipientCopy(milestoneCode, "vendorAgent", emailCopy, fileShape);
  if (tx.agentUser?.email && vendorAgentCopy && !skipAgentEmail) {
    const copy    = vendorAgentCopy;
    const vars    = { address, eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote };
    const greeting = buildGreeting(tx.agentUser.name);
    const html    = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: false, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote } });
    const subject = interpolate(copy.subject, vars);
    const text    = [greeting, "", interpolate(copy.whatHappened, vars)].join("\n");
    sendEmail({ to: tx.agentUser.email, subject, text, html, replyTo }).catch(() => {});
  }

  // Progressor notification — BUG2: suppress self-notification on outsourced when SP is the confirmer
  const skipProgressorEmail = serviceType === "outsourced" && tx.assignedUser?.id === confirmerId;
  const progressorCopy = resolveRecipientCopy(milestoneCode, "progressor", emailCopy, fileShape);
  if (tx.assignedUser?.email && progressorCopy && !skipProgressorEmail) {
    const copy    = progressorCopy;
    const vars    = { address, eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote };
    const greeting = buildGreeting(tx.assignedUser.name);
    const html    = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: true, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote } });
    const subject = interpolate(copy.subject, vars);
    const text    = [greeting, "", interpolate(copy.whatHappened, vars), `View: ${dashUrl}`].join("\n");
    sendEmail({ to: tx.assignedUser.email, subject, text, html, replyTo }).catch(() => {});
  }

  return true;
}

async function sendExchangeCompletionPack(transactionId: string, milestoneCode = "VM19", confirmerId?: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      completionDate: true,
      serviceType: true,
      contacts: {
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
      agentUser: { select: { id: true, name: true, email: true } },
      assignedUser: { select: { name: true, email: true } },
    },
  });
  if (!tx) return;

  const base        = process.env.NEXTAUTH_URL ?? "";
  const address     = tx.propertyAddress;
  const completionStr = tx.completionDate
    ? new Date(tx.completionDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  const dateBlurb = completionStr ? ` on <strong>${completionStr}</strong>` : "";
  const datePlain = completionStr ? ` on ${completionStr}` : "";

  const vendors    = tx.contacts.filter((c) => c.roleType === "vendor"    && c.email);
  const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser" && c.email);

  const vendorBodyHtml = `
    <p>Contracts have been exchanged on <strong>${address}</strong>${dateBlurb}. The sale is now legally committed.</p>
    <p style="margin-top:16px"><strong>What to expect on completion day:</strong></p>
    <ul style="padding-left:20px;line-height:2">
      <li>Your solicitor will handle the transfer of funds — you don't need to be at the property.</li>
      <li>Read all utility meters (gas, electricity, water) before you leave for the last time.</li>
      <li>Leave all keys, fobs, security codes, and gate remotes at the property (or hand to ${tx.agentUser?.name ?? "your agent"} or a member of our team).</li>
      <li>Leave appliance manuals, warranties, and service records — the buyer is entitled to these.</li>
      <li>Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.</li>
    </ul>`;
  const vendorBodyPlain = `Contracts have been exchanged on ${address}${datePlain}. The sale is now legally committed.\n\nWhat to expect on completion day:\n- Your solicitor will handle the transfer of funds — you don't need to be at the property.\n- Read all utility meters (gas, electricity, water) before you leave for the last time.\n- Leave all keys, fobs, security codes, and gate remotes at the property (or hand to ${tx.agentUser?.name ?? "your agent"} or a member of our team).\n- Leave appliance manuals, warranties, and service records — the buyer is entitled to these.\n- Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.`;

  const purchaserBodyHtml = `
    <p>Contracts have been exchanged on <strong>${address}</strong>${dateBlurb}. Your purchase is now legally committed.</p>
    <p style="margin-top:16px"><strong>What to expect on completion day:</strong></p>
    <ul style="padding-left:20px;line-height:2">
      <li>Keep your phone on — your solicitor will call you when the funds have been transferred.</li>
      <li>Keys are usually available from midday, once your solicitor confirms completion. ${tx.agentUser?.name ?? "Your agent"} or a member of our team will let you know.</li>
      <li>Read all utility meters (gas, electricity, water) when you arrive at the property.</li>
      <li>From today, the property is at your risk — if your buildings insurance isn't already in place, arrange it as soon as possible.</li>
      <li>Your solicitor will register your ownership at HM Land Registry after completion.</li>
    </ul>`;
  const purchaserBodyPlain = `Contracts have been exchanged on ${address}${datePlain}. Your purchase is now legally committed.\n\nWhat to expect on completion day:\n- Keep your phone on — your solicitor will call you when the funds have been transferred.\n- Keys are usually available from midday, once your solicitor confirms completion. ${tx.agentUser?.name ?? "Your agent"} or a member of our team will let you know.\n- Read all utility meters (gas, electricity, water) when you arrive at the property.\n- From today, the property is at your risk — if your buildings insurance isn't already in place, arrange it as soon as possible.\n- Your solicitor will register your ownership at HM Land Registry after completion.`;

  const vendorIds: string[] = [];
  for (const c of vendors) {
    const portalUrl = c.portalToken ? `${base}/portal/${c.portalToken}` : base;
    await sendEmail({
      to: c.email!,
      subject: `Contracts exchanged — what happens next for your sale`,
      text: `${buildGreeting(c.name)}\n\n${vendorBodyPlain}\n\nView your portal: ${portalUrl}`,
      html: portalEmailHtml({
        greeting: buildGreeting(c.name),
        body: vendorBodyHtml,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
    vendorIds.push(c.id);
  }
  if (vendorIds.length > 0) {
    logAutomatedEmail(transactionId, vendorIds, "Contracts exchanged — what happens next for your sale", vendorBodyPlain).catch(() => {});
  }

  const purchaserIds: string[] = [];
  for (const c of purchasers) {
    const portalUrl = c.portalToken ? `${base}/portal/${c.portalToken}` : base;
    await sendEmail({
      to: c.email!,
      subject: `Contracts exchanged — what happens next for your purchase`,
      text: `${buildGreeting(c.name)}\n\n${purchaserBodyPlain}\n\nView your portal: ${portalUrl}`,
      html: portalEmailHtml({
        greeting: buildGreeting(c.name),
        body: purchaserBodyHtml,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
    purchaserIds.push(c.id);
  }
  if (purchaserIds.length > 0) {
    logAutomatedEmail(transactionId, purchaserIds, "Contracts exchanged — what happens next for your purchase", purchaserBodyPlain).catch(() => {});
  }

  // Agent email — once only, on VM19 (PM26 is suppressed), outsourced files only
  if (milestoneCode === "VM19" && tx.agentUser?.email && tx.serviceType !== "self_managed") {
    const completionDateStr = tx.completionDate
      ? new Date(tx.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "to be confirmed";
    const dashUrl = `${base}/transactions/${transactionId}`;
    const agentCopy = getMilestoneCopy("VM19").emailCopy?.vendorAgent;
    if (agentCopy) {
      const greeting = buildGreeting(tx.agentUser.name);
      const progressorName = tx.assignedUser?.name ?? "Your sales progressor";
      const progressorEmail = tx.assignedUser?.email ?? "";
      const extraVars = { address, completionDate: completionDateStr };
      const html = richMilestoneEmailHtml({ greeting, copy: agentCopy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: false, serviceType: tx.serviceType ?? undefined, extraVars });
      const subject = interpolate(agentCopy.subject, { address });
      const text = [greeting, "", interpolate(agentCopy.whatHappened, extraVars)].join("\n");
      sendEmail({ to: tx.agentUser.email, subject, text, html }).catch(() => {});
    }
  }
}

export type TimelineEntry =
  | {
      type: "milestone";
      id: string;
      label: string;
      side: "vendor" | "purchaser";
      completedByName: string | null;
      confirmedByClient: boolean;
      eventDate: Date | null;
      createdAt: Date | null;
    }
  | {
      type: "update";
      id: string;
      content: string;
      method: string | null;
      createdAt: Date;
    };

// Milestone codes that always appear in the timeline regardless of timeSensitive
const KEY_MILESTONE_CODES = new Set(["VM12", "PM16", "VM13", "PM17"]);

export async function getPortalTimeline(
  transactionId: string,
  side: "vendor" | "purchaser",
  _contactId: string
): Promise<TimelineEntry[]> {
  return withRetry(async () => {
    const [completions, updates] = await Promise.all([
      prisma.milestoneCompletion.findMany({
        where: { transactionId, state: "complete" },
        include: {
          milestoneDefinition: { select: { code: true, side: true } },
          completedBy: { select: { name: true } },
        },
        orderBy: { completedAt: "desc" },
      }),
      prisma.outboundMessage.findMany({
        where: { transactionId, visibleToClient: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, method: true, createdAt: true },
      }),
    ]);

    const milestoneEntries: TimelineEntry[] = completions
      .map((c) => {
        const copy = getMilestoneCopy(c.milestoneDefinition.code);
        const isOtherSide = c.milestoneDefinition.side !== side;
        const label = isOtherSide ? (copy.labelOther ?? copy.label) : copy.label;
        return {
          type: "milestone" as const,
          id: c.id,
          label,
          side: c.milestoneDefinition.side as "vendor" | "purchaser",
          completedByName: c.completedBy?.name ?? null,
          confirmedByClient: c.confirmedByPortal,
          eventDate: c.eventDate ?? null,
          createdAt: c.completedAt,
        };
      });

    const updateEntries: TimelineEntry[] = updates.map((u) => ({
      type: "update" as const,
      id: u.id,
      content: u.content,
      method: u.method,
      createdAt: u.createdAt,
    }));

    const all = [...milestoneEntries, ...updateEntries];
    all.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return all;
  });
}

// Only these codes may be marked not-required by the client, with their cascades
const PORTAL_NOT_REQUIRED_WHITELIST: Record<string, string[]> = {
  PM9: ["PM10"],
};

export async function portalMarkNotRequired(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const def = await prisma.milestoneDefinition.findFirst({
    where: { id: input.milestoneDefinitionId, side },
    select: { id: true, code: true },
  });
  if (!def) throw new Error("Milestone not found");

  const cascadeCodes = PORTAL_NOT_REQUIRED_WHITELIST[def.code];
  if (!cascadeCodes) throw new Error("Cannot mark this milestone as not required from the portal");

  const now = new Date();
  const txId = contact.propertyTransactionId;

  await prisma.milestoneCompletion.upsert({
    where: { transactionId_milestoneDefinitionId: { transactionId: txId, milestoneDefinitionId: def.id } },
    create: { transactionId: txId, milestoneDefinitionId: def.id, state: "not_required", notRequiredReason: "Marked not required by client via portal" },
    update: { state: "not_required", notRequiredReason: "Marked not required by client via portal", completedAt: null },
  });

  if (cascadeCodes.length > 0) {
    const cascadeDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: cascadeCodes }, side },
      select: { id: true },
    });
    for (const cd of cascadeDefs) {
      await prisma.milestoneCompletion.upsert({
        where: { transactionId_milestoneDefinitionId: { transactionId: txId, milestoneDefinitionId: cd.id } },
        create: { transactionId: txId, milestoneDefinitionId: cd.id, state: "not_required", notRequiredReason: "Cascade: not required (survey skipped via portal)" },
        update: { state: "not_required", notRequiredReason: "Cascade: not required (survey skipped via portal)", completedAt: null },
      });
    }
  }
}

export async function getPortalViewDates(transactionId: string): Promise<Record<string, Date>> {
  const records = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      type: "internal_note",
      content: { contains: "viewed their client portal" },
    },
    select: { contactIds: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const result: Record<string, Date> = {};
  for (const r of records) {
    for (const cid of r.contactIds) {
      if (!result[cid]) result[cid] = r.createdAt;
    }
  }
  return result;
}

export async function getPortalUpdates(transactionId: string): Promise<PortalUpdate[]> {
  return withRetry(() => prisma.outboundMessage.findMany({
    where: { transactionId, visibleToClient: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, method: true, createdAt: true },
  }));
}
