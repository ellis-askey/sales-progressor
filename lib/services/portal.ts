import { prisma } from "@/lib/prisma";
import { getBookedSurveyorName } from "@/lib/services/survey-booking";
import { preheader } from "@/lib/email/preheader";
import { extractPostcode } from "@/lib/services/property-intel";
import { sendEmail } from "@/lib/email";
import { getChainForTransactionV2 } from "@/lib/services/chains";
import { pushToContact, pushToTransaction, pushToUser } from "@/lib/services/push";
import { getMilestoneCopy, buildGreeting, type MilestoneEmailCopy, type RecipientEmailCopy } from "@/lib/portal-copy";
import {
  getOverridesForCode,
  applyOverridesToEmailCopy,
  normalizeMethod,
  normalizeTenure,
} from "@/lib/services/milestone-copy-overrides";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
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
import { enqueueEmail } from "@/lib/email/outboundQueue";
import type { MilestoneDigestPayload } from "@/lib/email/milestone-digest";
import {
  EXCHANGE_COMPLETION_CODES,
  AUTO_COUNTERPART_OF,
  isExchangeCompletionStale,
  decideCompletionPackTiming,
} from "@/lib/services/exchange-completion-rules";
import { extractFirstName } from "@/lib/contacts/displayName";
import { completeMilestone } from "@/lib/services/milestones";
import { notifyPortalMilestoneConfirmed, notifyOutsourcedMilestoneConfirmed } from "@/lib/services/notifications";
import { maybeFireFirstExchangeEmail } from "@/lib/services/retention";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { PORTAL_AGENT_ONLY_CODES } from "@/lib/chase/portal-agent-only-codes";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";
import { forRound, vendorOnly, milestoneScopeWhere, type MilestoneScope } from "@/lib/services/milestone-scope";

// ─── Phase 1 commit 5 — portal privacy scoping helpers ───────────────────────
//
// Contact-roleType drives the portal's effective round:
//   - Purchaser contact: their own buyerRoundId. If !== tx.activeBuyerRoundId,
//     the token is treated as DEAD (belt-and-braces, regardless of token
//     null/rotate state). Returns from getPortalData as { deadRound: true }
//     so the portal layout can render a friendly notice instead of 404.
//   - Vendor contact: file-level. Their effective milestone scope is
//     vendor file-level VMs + the ACTIVE round's PMs (the vendor sees the
//     CURRENT buyer's progress alongside their own).
//
// The forRound helper handles the cross-side prereq read; here we use it
// to pick the correct round's PM partition based on the caller's role.

type PortalRoundContext = {
  // Effective round id for THIS portal session — purchaser's own round, or
  // the file's active round for vendor.
  roundIdForMilestones: string | null;
  // True only for purchaser contacts whose buyerRoundId !== activeBuyerRoundId.
  // Belt-and-braces dead-token guard: even if the token was somehow not
  // rotated, the round mismatch makes it inert.
  deadRound: boolean;
};

// Page-side convenience: given the layout's contact + tx, return the scope
// for the CALLER'S OWN side (purchaser PM view = own round; vendor VM view
// = file-level) and the OTHER side (purchaser viewing vendor = file-level;
// vendor viewing purchaser = active round's PMs). Pages use these to drive
// getPortalMilestones; the scoping for each call falls out of one rule:
// purchaser sees only their own round; vendor sees the file + the active
// round's PMs.
export function portalOwnSideScope(
  contact: { roleType: string; buyerRoundId: string | null },
  tx: { id: string; activeBuyerRoundId: string | null },
): MilestoneScope {
  if (contact.roleType === "purchaser") {
    return forRound(contact.buyerRoundId, tx.id);
  }
  return vendorOnly();
}

export function portalOtherSideScope(
  contact: { roleType: string; buyerRoundId: string | null },
  tx: { id: string; activeBuyerRoundId: string | null },
): MilestoneScope {
  if (contact.roleType === "purchaser") {
    // Purchaser viewing the vendor's side — file-level VMs only.
    return vendorOnly();
  }
  // Vendor viewing the purchaser side — the ACTIVE round's PMs (mirror of
  // the current buyer's progress, not an archived round's).
  return forRound(tx.activeBuyerRoundId, tx.id);
}

function resolvePortalRoundContext(
  contact: { roleType: string; buyerRoundId: string | null },
  tx: { activeBuyerRoundId: string | null },
): PortalRoundContext {
  if (contact.roleType === "purchaser") {
    // Purchaser: their own round. If it doesn't match the file's active
    // round, the token is dead.
    if (contact.buyerRoundId == null) {
      // Edge: pre-Phase-0 backfill purchaser without a stamped round.
      // Treat as the file's active round (degraded, but the file's
      // round-1 backfill catches this).
      return { roundIdForMilestones: tx.activeBuyerRoundId, deadRound: false };
    }
    if (contact.buyerRoundId !== tx.activeBuyerRoundId) {
      return { roundIdForMilestones: contact.buyerRoundId, deadRound: true };
    }
    return { roundIdForMilestones: contact.buyerRoundId, deadRound: false };
  }
  // Vendor (or any non-purchaser surface): file-level + active round PM mirror.
  return { roundIdForMilestones: tx.activeBuyerRoundId, deadRound: false };
}

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

export async function logAutomatedEmail(
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

  // Phase-2 PR 3 (OutboundMessage write-path gap fix): stamp buyerRoundId
  // at create. Pre-PR-3 this write site was the known gap on the audit —
  // every other OutboundMessage create stamps via decideBuyerSideStamp /
  // contact.buyerRoundId, but logAutomatedEmail was committing rows with
  // buyerRoundId NULL, leaving downstream read-path filters unable to
  // discriminate active-round automated emails from fall-through ones.
  //
  // Same attribution rule the queue drain mirror uses (PR 1.5): if ALL
  // contactIds resolve to purchaser-role Contacts on the same
  // buyerRoundId, stamp the OutboundMessage with that buyerRoundId. Any
  // mixed set (or vendor / solicitor / broker contacts) → file-level NULL.
  let stampRoundId: string | null = null;
  if (contactIds.length > 0) {
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { roleType: true, buyerRoundId: true },
    });
    if (
      contacts.length === contactIds.length &&
      contacts.every((c) => c.roleType === "purchaser") &&
      contacts.every((c) => c.buyerRoundId !== null) &&
      new Set(contacts.map((c) => c.buyerRoundId)).size === 1
    ) {
      stampRoundId = contacts[0].buyerRoundId;
    }
  }

  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "outbound",
      method: "email",
      isAutomated: true,
      contactIds,
      content: `Subject: ${subject}\n\n${stripped}`,
      createdById: null,
      buyerRoundId: stampRoundId,
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

// Phase 1 commit 5 — dead-round marker. The portal layout (app/portal/[token]/page.tsx)
// branches on this to render a friendly "this link is no longer active" notice
// instead of treating it as a 404, so an old buyer's bookmarked link explains
// itself rather than disappearing.
export type PortalDataResult =
  | { kind: "ok"; data: NonNullable<Awaited<ReturnType<typeof getPortalDataInner>>> }
  | { kind: "deadRound"; contactName: string; agencyName: string; address: string }
  | null;

async function getPortalDataInner(token: string) {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      roleType: true,
      buyerRoundId: true,
      propertyTransactionId: true,
    },
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
      activeBuyerRoundId: true,
      photoStoragePath: true,
      photoUploadedAt: true,
      bookedSurveyorName: true,
      agency: { select: { name: true } },
    },
  });
  if (!tx) return null;

  const postcode = extractPostcode(tx.propertyAddress);

  // Sign a fresh URL for the hero photo if one is set. Signed URLs expire
  // after an hour; we mint on read so the page always ships a fresh one.
  let photoUrl: string | null = null;
  if (tx.photoStoragePath) {
    try {
      const { getSignedUrl } = await import("@/lib/supabase-storage");
      photoUrl = await getSignedUrl(tx.photoStoragePath, 3600);
    } catch (err) {
      console.warn("[portal] failed to sign property-photo URL", err);
    }
  }

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
      activeBuyerRoundId: tx.activeBuyerRoundId,
      bookedSurveyorName: tx.bookedSurveyorName,
      photoUrl,
    },
  };
}

export async function getPortalData(token: string): Promise<PortalDataResult> {
  return withRetry(async () => {
    const inner = await getPortalDataInner(token);
    if (!inner) return null;
    const roundCtx = resolvePortalRoundContext(inner.contact, inner.transaction);
    if (roundCtx.deadRound) {
      // Phase 1 commit 5 belt-and-braces — surface as deadRound EVEN if the
      // token wasn't rotated. Either condition is sufficient to inhibit the
      // portal; both is the production case post-relist.
      return {
        kind: "deadRound" as const,
        contactName: inner.contact.name,
        agencyName: inner.transaction.agencyName,
        address: inner.transaction.propertyAddress,
      };
    }
    return { kind: "ok" as const, data: inner };
  });
}

// ── "Your team" card (audit #16) ────────────────────────────────────────────
// The people looking after this file, for the portal overview:
//   - The person managing it: the assigned progressor on an outsourced file,
//     or the agency's own agent on a self-managed one. Name, photo, and the
//     email that file actually sends from (verified-domain address, or the
//     fallback for agencies without one) so "Email" reaches the right inbox.
//   - The solicitor firm on the viewer's own side (name only; no contact
//     details, per the deliberate decision not to route clients straight to
//     the solicitor).
// WhatsApp is currently the single progressor line (+447508862929, same number
// the intro email uses), so it only surfaces on outsourced files; when
// per-user WhatsApp numbers land this reads from the managing user instead.
export type PortalTeam = {
  managing: {
    // email is the AGENCY-assigned sender address, or null when unset (hidden).
    name: string;
    image: string | null;
    email: string | null;
    roleLabel: string;
    whatsappUrl: string | null;
  } | null;
  solicitorFirmName: string | null;
  // The client's neighbouring chain agent (phase 3) — drives the buyer's
  // "add your selling agent" row on the card.
  chainAgent: PortalChainAgent;
};

// ── The client's neighbouring chain agent (audit #16, phase 3) ──────────────
// The agent on the other side of the client's own move:
//   - Seller (vendor) is buying onward → the agent selling the place they're
//     BUYING = the chain link ABOVE them (position - 1).
//   - Buyer (purchaser) is selling their current home → the agent selling
//     THAT = the chain link BELOW them (position + 1).
// Pre-filled from whatever the managing agent already entered as a stub. Once
// that agent has actually joined (link.transactionId set) it's read-only.
export type PortalChainAgent = {
  label: string;                 // client-facing label for this neighbour
  direction: "above" | "below";
  present: boolean;              // is there a neighbour link at all?
  editable: boolean;             // stub → editable; claimed agent → read-only
  linkId: string | null;
  agentName: string | null;
  agencyName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  propertyAddress: string | null;
  canManage: boolean;            // is there a managing user to attribute writes to?
};

export async function getPortalChainAgent(
  transactionId: string,
  side: "vendor" | "purchaser",
): Promise<PortalChainAgent> {
  const direction: "above" | "below" = side === "vendor" ? "above" : "below";
  const label = side === "vendor" ? "Your onward-purchase agent" : "Your selling agent";

  // A managing user is required to attribute any chain write (createdByUserId).
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { serviceType: true, assignedUserId: true, agentUserId: true },
  });
  const managingUserId = tx
    ? (tx.serviceType !== "self_managed" ? tx.assignedUserId : tx.agentUserId)
    : null;

  const base: PortalChainAgent = {
    label, direction, present: false, editable: true, linkId: null,
    agentName: null, agencyName: null, agentEmail: null, agentPhone: null,
    propertyAddress: null, canManage: !!managingUserId,
  };

  const chain = await getChainForTransactionV2(transactionId).catch(() => null);
  if (!chain) return base; // no chain yet — adding one is allowed (creates it)

  const own = chain.links.find((l) => l.transactionId === transactionId);
  if (!own) return base;
  const targetPos = direction === "above" ? own.position - 1 : own.position + 1;
  const neighbour = chain.links.find((l) => l.position === targetPos);
  if (!neighbour) return base; // no neighbour link yet — client can add one

  const claimed = neighbour.transactionId !== null;
  return {
    ...base,
    present: true,
    editable: !claimed,
    linkId: neighbour.id,
    agentName:   claimed ? (neighbour.claimedBy?.name ?? null)    : neighbour.stubAgentName,
    agencyName:  claimed ? (neighbour.claimedBy?.firmName ?? null) : neighbour.stubAgencyName,
    // A joined agent's contact details aren't exposed here (they're on the
    // platform now); only unclaimed stub details are shown back to the client.
    agentEmail:  claimed ? null : neighbour.stubAgentEmail,
    agentPhone:  claimed ? null : neighbour.stubAgentPhone,
    propertyAddress: claimed ? (neighbour.transaction?.propertyAddress ?? null) : neighbour.stubPropertyAddress,
  };
}

export async function getPortalTeam(
  transactionId: string,
  side: "vendor" | "purchaser",
): Promise<PortalTeam> {
  return withRetry(async () => {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: {
        serviceType: true,
        assignedUser: { select: { id: true, name: true, email: true, image: true, role: true } },
        agentUser:    { select: { id: true, name: true, email: true, image: true, role: true } },
        vendorSolicitorFirm:    { select: { name: true } },
        purchaserSolicitorFirm: { select: { name: true } },
        agency: { select: { quoteSenderEmail: true } },
      },
    });
    if (!tx) {
      return {
        managing: null,
        solicitorFirmName: null,
        chainAgent: {
          label: side === "vendor" ? "Your onward-purchase agent" : "Your selling agent",
          direction: side === "vendor" ? "above" : "below",
          present: false, editable: false, linkId: null,
          agentName: null, agencyName: null, agentEmail: null, agentPhone: null,
          propertyAddress: null, canManage: false,
        },
      };
    }

    const isOutsourced = tx.serviceType !== "self_managed";
    const person = isOutsourced ? tx.assignedUser : tx.agentUser;

    let managing: PortalTeam["managing"] = null;
    if (person) {
      // The email shown to the client is the address ASSIGNED TO THE AGENCY
      // (Agency.quoteSenderEmail). No generic fallback: if the agency has none
      // set, email is null and the card hides the Email button + address rather
      // than leaking the internal updates@ / progressor address. (Founder,
      // 2026-08-15.)
      const agencyEmail = tx.agency?.quoteSenderEmail?.trim() || null;
      managing = {
        name: person.name ?? "Your progressor",
        image: person.image ?? null,
        email: agencyEmail,
        roleLabel: isOutsourced ? "Your progressor" : "Your agent",
        whatsappUrl: isOutsourced ? "https://wa.me/447508862929" : null,
      };
    }

    const solicitorFirmName =
      side === "vendor"
        ? tx.vendorSolicitorFirm?.name ?? null
        : tx.purchaserSolicitorFirm?.name ?? null;

    const chainAgent = await getPortalChainAgent(transactionId, side);

    return { managing, solicitorFirmName, chainAgent };
  });
}

// Phase 1 commit 5 — round-scoped read.
//
// `scope` decides which MilestoneCompletion rows are visible:
//   - Purchaser viewer asking for THEIR PMs:    forRound(contact.buyerRoundId, txId)
//   - Purchaser viewer asking for vendor VMs:    vendorOnly()       (or forRound — VMs file-level)
//   - Vendor viewer asking for vendor VMs:       vendorOnly()
//   - Vendor viewer asking for current PMs:     forRound(activeBuyerRoundId, txId)
//
// `side` filters MilestoneDefinition — so a vendor scope + purchaser side
// returns nothing (definitions don't match). The two parameters are
// orthogonal and the caller composes them.
export async function getPortalMilestones(
  transactionId: string,
  side: "vendor" | "purchaser",
  scope: MilestoneScope,
): Promise<PortalMilestone[]> {
  return withRetry(async () => {
    // Retired enquiry sub-steps are hidden from the client portal too
    // (enquiries rework).
    const defs = (await prisma.milestoneDefinition.findMany({
      where: { side },
      orderBy: { orderIndex: "asc" },
    })).filter((d) => !RETIRED_ENQUIRY_CODES.has(d.code));

    const completions = await prisma.milestoneCompletion.findMany({
      where: { transactionId, ...milestoneScopeWhere(scope) },
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
      buyerRoundId: true,
      propertyTransactionId: true,
      transaction: {
        select: {
          propertyAddress: true,
          activeBuyerRoundId: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!contact) return;

  // Phase 1 commit 5 — silent skip on dead-round tokens. A stale purchaser
  // hitting their old portal link should NOT generate an internal note on
  // the new buyer's file ("Jane viewed her portal for ..." when Jane is no
  // longer the buyer). The DeadRoundNotice renders client-side; nothing
  // gets logged server-side.
  if (
    contact.roleType === "purchaser" &&
    contact.buyerRoundId != null &&
    contact.buyerRoundId !== contact.transaction.activeBuyerRoundId
  ) {
    return;
  }

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
    select: { id: true, name: true, roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  // Phase 1 commit 5 — belt-and-braces dead-round guard. A purchaser whose
  // round no longer matches the file's active round cannot confirm. The
  // token rotation in commit 6's relist action makes this unreachable in
  // production, but the round-mismatch check is a second line of defence.
  const txForGuard = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { activeBuyerRoundId: true },
  });
  if (!txForGuard) throw new Error("Invalid transaction");
  if (
    contact.roleType === "purchaser" &&
    contact.buyerRoundId != null &&
    contact.buyerRoundId !== txForGuard.activeBuyerRoundId
  ) {
    throw new Error("Invalid token");
  }

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

  // Phase 1 commit 5 — scope to the contact's effective round so a
  // purchaser can't read or act on a previous round's PM row of the same
  // definition. Vendor side stays file-level (VMs are file-level rows).
  const roundScope = contact.roleType === "purchaser"
    ? forRound(contact.buyerRoundId, contact.propertyTransactionId)
    : vendorOnly();

  // Milestone must be in available state to be confirmed via portal.
  // findFirst by (tx, def) — the compound unique was replaced by partial
  // indexes in Phase 1 commit 1; for a pre-relist file the single row
  // is matched the same way.
  const current = await prisma.milestoneCompletion.findFirst({
    where: {
      transactionId: contact.propertyTransactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      ...milestoneScopeWhere(roundScope),
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
    // NB: PM20→VM21 (enquiries satisfied) now lives inside completeMilestone, so
    // it fires on every confirm path — see the reflection in lib/services/milestones.ts.
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
      // Phase 1 commit 5 — counterpart sits on the OPPOSITE side of the
      // confirming role. Vendor confirming VM19 looks up PM26 on the
      // ACTIVE round; purchaser confirming PM26 looks up VM19 file-level.
      // forRound(activeBuyerRoundId, txId) covers both (vendor file-level
      // rows are always returned; only the active round's PMs are).
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: contact.propertyTransactionId,
          milestoneDefinitionId: counterDefId,
          state: "complete",
          ...milestoneScopeWhere(forRound(txForGuard.activeBuyerRoundId, contact.propertyTransactionId)),
        },
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

  // Auto-counterpart fan-out for the four exchange/completion codes
  // (VM19↔PM26, VM20↔PM27). The DB row for the counterpart was already
  // completed inside the prisma.$transaction above; this fires its
  // customer-facing email so the non-confirming side is notified.
  // confirmerRoute is "client_portal" on this path (clients reach
  // logPortalMilestoneConfirm from their portal). Non-counterpart codes
  // are a no-op inside the helper.
  fireAutoCounterpartEmails(contact.propertyTransactionId, def.code, undefined, "client_portal").catch(() => {});

  // Completion-pack scheduling for exchange confirmations only. Fires
  // now (E2/E3), schedules for completionDate - 3 days (E1), or skips
  // if completion is in the past. See decideCompletionPackTiming.
  if (def.code === "VM19" || def.code === "PM26") {
    scheduleOrSendCompletionPack(contact.propertyTransactionId, def.code).catch(() => {});
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
      // Phase 1 commit 5 — required for round-scoping the bilateral
      // counterpart lookup so the wrong round's PM26/PM27 state can't
      // influence email direction picking.
      activeBuyerRoundId: true,
      // tenure + purchaseType added 2026-05-27 for Model B skeleton mode.
      // Used by resolveRecipientCopy via the FileShape construction below.
      // Nullable on the schema; null short-circuits the assembler path.
      tenure: true,
      purchaseType: true,
      // Added 2026-06-17: VM19.vendorAgent ("Completion is set for
      // {completionDate}.") references the recorded completion date.
      // Without this select the var is undefined and the placeholder
      // renders literally — see comment on completionDateVar below.
      completionDate: true,
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
    ? await isBilateralCounterpartComplete(transactionId, milestoneCode, forRound(tx.activeBuyerRoundId, transactionId))
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
      subject: `Client confirmed: "${milestoneLabel}" at ${tx.propertyAddress}`,
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

  const baseRichCopy = milestoneCode ? getMilestoneCopy(milestoneCode).emailCopy : null;
  // Command Centre copy overrides — merge saved scenario-scoped edits over the
  // code default, using the file's real tenure + purchase type.
  const richCopy =
    baseRichCopy && milestoneCode
      ? applyOverridesToEmailCopy(
          baseRichCopy,
          { tenure: normalizeTenure(tx.tenure), method: normalizeMethod(tx.purchaseType) },
          await getOverridesForCode(milestoneCode)
        )
      : baseRichCopy;

  if (richCopy) {
    // Compute event-date vars for portal-confirmed milestones (same logic as sendRichMilestoneEmails)
    const formattedPortalEventDate = eventDate
      ? new Date(eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : null;
    const portalEventDateVar = formattedPortalEventDate ? `, ${formattedPortalEventDate}` : "";
    const portalEventDateClause = formattedPortalEventDate
      ? `booked for ${formattedPortalEventDate}`
      : milestoneCode === "PM6" ? "a desktop valuation (no physical visit required)" : "";
    const isPortalDesktop = milestoneCode === "PM6" && !formattedPortalEventDate;
    const purchaserPhysicalNote = (milestoneCode === "PM6" && !isPortalDesktop)
      ? " Their primary concern is that it's worth enough to secure their loan. It's not a structural survey and won't flag problems with the condition of the property."
      : "";
    const vendorVisitNote = milestoneCode === "PM6"
      ? isPortalDesktop
        ? " No physical visit to the property is needed. The assessment is conducted remotely."
        : " A surveyor acting for the lender will visit to value the property. Access has been arranged, so nothing else for you to do right now."
      : "";
    // Mirrors the {completionDate} handling in sendRichMilestoneEmails —
    // see the comment there. Same fallback string so the portal-confirmed
    // and admin-confirmed exchange emails render identically when no
    // completion date is on record.
    const portalCompletionDateVar = tx.completionDate
      ? new Date(tx.completionDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "a date to be confirmed";
    // {surveyorClause} — " with <firm>" on the survey-booked email when we know
    // who was booked (our quoted firm or a client-typed outside firm), else "".
    let surveyorClause = "";
    if (milestoneCode === "PM9") {
      const n = await getBookedSurveyorName(transactionId);
      if (n) surveyorClause = ` with ${n}`;
    }
    // {valuationNote} — mortgage-only paragraph on the buyer's survey-booked
    // email (cash buyers have no lender valuation to distinguish it from).
    const valuationNote = (milestoneCode === "PM9" && tx.purchaseType === "mortgage")
      ? " This is your own survey and is separate from your lender's valuation. The lender's valuation is primarily for their benefit, whereas your survey gives you a much more detailed picture of the property's condition."
      : "";
    const portalVars = { address, eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: portalCompletionDateVar, surveyorClause, valuationNote };

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
      const html      = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: portalUrl, progressorName, progressorEmail, serviceType, extraVars: { eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: portalCompletionDateVar, surveyorClause, valuationNote } });
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
      const html     = richMilestoneEmailHtml({ greeting, copy: agentCopy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: false, serviceType, extraVars: { eventDate: portalEventDateVar, eventDateClause: portalEventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: portalCompletionDateVar, surveyorClause, valuationNote } });
      sendEmail({ to: tx.agentUser.email, subject, html, text, replyTo }).catch(() => {});
    }
  } else {
    // Fallback for milestones without structured emailCopy: generic thank-you to confirming
    // contact and generic progress update to the other side.
    if (confirmingContact?.email && confirmingContact.portalToken) {
      const portalUrl = `${base}/portal/${confirmingContact.portalToken}`;
      const confirmSubject = `Step confirmed: ${address}`;
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
    const otherSaleWord = otherSideRole === "vendor" ? "sale" : "purchase";
    // Name the step that was confirmed, using its ready-made other-side label
    // ("Seller instructed their solicitor" → "the seller instructed their
    // solicitor"), so the email says WHAT changed instead of a vague "there's
    // been a progress update". Falls back to the generic line for the few
    // steps with no other-side label. (Audit #9.)
    const otherLabelRaw = milestoneCode ? getMilestoneCopy(milestoneCode).labelOther : undefined;
    const otherStep = otherLabelRaw ? `the ${otherLabelRaw.charAt(0).toLowerCase()}${otherLabelRaw.slice(1)}` : null;
    const otherUpdateText = otherStep
      ? `There's an update on your ${otherSaleWord} at ${address}: ${otherStep}. Log in to see the latest.`
      : `There's been a progress update on your ${otherSaleWord} at ${address}. Log in to see the latest.`;
    const otherUpdateHtml = otherStep
      ? `There's an update on your ${otherSaleWord} at <strong>${address}</strong>: ${otherStep}. Log in to see the latest.`
      : `There's been a progress update on your ${otherSaleWord} at <strong>${address}</strong>. Log in to your portal to see the latest.`;
    const otherContacts = tx.contacts.filter(
      (c) => c.id !== contactId && c.roleType === otherSideRole && c.email && c.portalToken
    );
    const otherIds: string[] = [];
    for (const other of otherContacts) {
      const portalUrl = `${base}/portal/${other.portalToken!}`;
      const otherText = [
        buildGreeting(other.name),
        ``,
        otherUpdateText,
        ``,
        `View your portal: ${portalUrl}`,
      ].join("\n");
      sendEmail({
        to: other.email!,
        subject: `Progress update: ${address}`,
        text: otherText,
        replyTo,
        html: portalEmailHtml({
          greeting: buildGreeting(other.name),
          body: otherUpdateHtml,
          ctaText: "View your portal",
          ctaUrl: portalUrl,
        }),
      }).catch(() => {});
      otherIds.push(other.id);
    }
    if (otherIds.length > 0) {
      logAutomatedEmail(transactionId, otherIds, `Progress update: ${address}`, otherUpdateText).catch(() => {});
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
  // 2026-05-29: delegation to sendExchangeCompletionPack removed. The
  // FINAL VM19/PM26 skeletons were dead code under the old delegation.
  // Now VM19/PM26 take the normal sendRichMilestoneEmails path (which
  // applies the queue-bypass + staleness rules in
  // exchange-completion-rules.ts). The completion-pack ("what to expect
  // on completion day") is scheduled separately via
  // scheduleOrSendCompletionPack from the agent and portal call sites.

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
      subject = `Your ${saleWord} has completed: ${address}`;
      headline = saleWord === "sale" ? "Sale complete!" : "Purchase complete!";
      intro = `Congratulations. Your ${saleWord} at <strong>${address}</strong> has completed${completionDateStr ? ` on <strong>${completionDateStr}</strong>` : ""}. The keys have been handed over and funds transferred.`;
    } else if (isReadyToExchange) {
      subject = `Ready to exchange: ${address}`;
      headline = "Ready to exchange";
      intro = `Your solicitor has confirmed everything is in place for your ${saleWord} at <strong>${address}</strong>. Exchange of contracts is imminent.`;
    } else if (dateStr) {
      subject = `Date confirmed: ${address}`;
      headline = "Date confirmed";
      intro = `A date has been confirmed for your ${saleWord} at <strong>${address}</strong>.`;
      stepLabel = portalLabel;
      stepDate = dateStr;
    } else {
      subject = `Progress update: ${address}`;
      headline = "Progress update";
      intro = `Your ${saleWord} at <strong>${address}</strong> is moving forward.`;
      stepLabel = portalLabel;
    }

    const html = portalProgressEmailHtml({ firstName, address, headline, intro, stepLabel, stepDate, portalUrl });
    const lines = [`Hi ${firstName},`, "", intro.replace(/<[^>]+>/g, ""), ""];
    if (stepLabel) lines.push(`  ✓ ${stepLabel}${stepDate ? `: ${stepDate}` : ""}`, "");
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

// "Thursday 13th August 2026" — warmer for customer copy than the clinical
// "Thursday, 13 August 2026" that toLocaleDateString spits out. Only used
// by attendClause so far (PM6 buyer email).
function formatWeekdayOrdinal(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const year = date.getFullYear();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  return `${weekday} ${day}${suffix} ${month} ${year}`;
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
    ? `<p style="margin:0;font-size:12px;color:#8b91a3">Sales Progressor system: ${address}</p>`
    : serviceType === "self_managed"
      ? `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Just reply to this email.</p>`
      : whatsappNumber
        ? `<p style="margin:0 0 12px;font-size:13px;color:#4a5162">Questions? Your progressor is <strong>${progressorName}</strong>.</p>
           <a href="https://wa.me/${whatsappNumber}" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
             Message me on WhatsApp
           </a>`
        : `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Your progressor is <strong>${progressorName}</strong>.</p>`;

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">${preheader("A step just moved forward. Here's where things are up to.")}
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
  // Phase 1 commit 5 — when provided, scopes the counterpart lookup so a
  // previous round's completed PM doesn't get mistaken for the CURRENT
  // round's state. Required for any portal call where multiple rounds may
  // exist on the same tx. Optional for legacy agent-action callers — for
  // pre-relist tx state (one round, single row per def) the unscoped read
  // returns the same row, so behaviour is unchanged.
  scope?: MilestoneScope,
): Promise<boolean> {
  const counterCode = BILATERAL_PAIR_OF[currentCode];
  if (!counterCode) return false;
  const counterDef = await prisma.milestoneDefinition.findFirst({
    where: { code: counterCode },
    select: { id: true },
  });
  if (!counterDef) return false;
  const completion = await prisma.milestoneCompletion.findFirst({
    where: {
      transactionId,
      milestoneDefinitionId: counterDef.id,
      ...(scope ? milestoneScopeWhere(scope) : {}),
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
      // Added 2026-05-29: needed for the staleness check on the four
      // exchange/completion codes (VM19/PM26/VM20/PM27) — see
      // isExchangeCompletionStale in exchange-completion-rules.ts.
      expectedExchangeDate: true,
      completionDate: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      agentUser: { select: { id: true, name: true, email: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return false;

  // Command Centre copy overrides — merge any saved, scenario-scoped edits over
  // the code default before anything is interpolated/enqueued. Uses the file's
  // real tenure + purchase type to pick the most-specific saved version.
  const overrideRows = await getOverridesForCode(milestoneCode);
  const effectiveEmailCopy = applyOverridesToEmailCopy(
    emailCopy,
    { tenure: normalizeTenure(tx.tenure), method: normalizeMethod(tx.purchaseType) },
    overrideRows
  );

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
  // Ordinal form ("Thursday 13th August 2026") for customer-facing sentences
  // where "on Thursday, 13 August 2026" reads clinical. Used by {attendClause}.
  const formattedEventDateOrdinal = eventDate
    ? formatWeekdayOrdinal(new Date(eventDate))
    : null;
  // {eventDate} — " on Monday, 7 May 2026" prefix or "" (used in PM9 opening/whatHappened)
  const eventDateVar = formattedEventDate ? `, ${formattedEventDate}` : "";
  // {eventDateClause} — full descriptive clause for PM6 (physical vs desktop valuation)
  const eventDateClause = formattedEventDate
    ? `booked for ${formattedEventDate}`
    : milestoneCode === "PM6" ? "a desktop valuation (no physical visit required)" : "";
  // {attendClause} — customer-friendly appendage for the PM6 buyer email.
  // Landed 2026-08-09 after Ellis flagged the missing space + clinical
  // phrasing in the previous "propertybooked for..." rendering.
  const attendClause = formattedEventDateOrdinal
    ? ` and will attend on ${formattedEventDateOrdinal}`
    : "";
  // {surveyorClause} — " with <firm>" on the survey-booked email, else "".
  let surveyorClause = "";
  if (milestoneCode === "PM9") {
    const n = await getBookedSurveyorName(transactionId);
    if (n) surveyorClause = ` with ${n}`;
  }
  // {valuationNote} — mortgage-only paragraph on the buyer's survey-booked email.
  const valuationNote = (milestoneCode === "PM9" && tx.purchaseType === "mortgage")
    ? " This is your own survey and is separate from your lender's valuation. The lender's valuation is primarily for their benefit, whereas your survey gives you a much more detailed picture of the property's condition."
    : "";
  const isDesktop = milestoneCode === "PM6" && !formattedEventDate;
  const purchaserPhysicalNote = (milestoneCode === "PM6" && !isDesktop)
    ? " Their primary concern is that it's worth enough to secure their loan. It's not a structural survey and won't flag problems with the condition of the property."
    : "";
  const vendorVisitNote = milestoneCode === "PM6"
    ? isDesktop
      ? " No physical visit to the property is needed. The assessment is conducted remotely."
      : " A surveyor acting for the lender will visit to value the property. Access has been arranged, so nothing else for you to do right now."
    : "";
  // {completionDate} — referenced by VM19.vendorAgent ("Completion is set
  // for {completionDate}.") and any future exchange/completion copy that
  // needs the recorded completion date. tx.completionDate is loaded above
  // and is nullable: if unset, we render a soft fallback so the sentence
  // still scans. Without this var the interpolate() helper falls through
  // to the literal "{completionDate}" placeholder in the email body
  // (regression surfaced 2026-06-17 on the VM19 exchange-confirmed email).
  const completionDateVar = tx.completionDate
    ? new Date(tx.completionDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "a date to be confirmed";

  // Bilateral pair-complete suppression. See computeBilateralSuppressedRecipient
  // for the rule. When a bilateral milestone fires in INVERSE direction,
  // the side that acted on the counterpart is suppressed — they were
  // emailed when they confirmed and must not be re-notified now. Runs
  // BEFORE the enqueue so suppressed sides never get a queue row, exactly
  // as suppression ran before the send call pre-batching.
  const suppressedRecipient = computeBilateralSuppressedRecipient(milestoneCode, handoffDirection);

  // Exchange/completion handling. The four codes VM19/PM26/VM20/PM27
  // use the shorter 60s delay through the queue (still feel discrete,
  // customer emails) AND respect a staleness rule: if the agent is
  // catching up well after the recorded date, the customer-facing email
  // is suppressed. Internal-audience emails (vendorAgent, progressor)
  // are never suppressed by either rule.
  const isExchangeCompletion = EXCHANGE_COMPLETION_CODES.has(milestoneCode);
  const customerSuppressedByStaleness = isExchangeCompletion && isExchangeCompletionStale(
    milestoneCode,
    { expectedExchangeDate: tx.expectedExchangeDate, completionDate: tx.completionDate },
  );

  // Vendor and purchaser contacts — enqueued for the 5-minute batching
  // window rather than sent synchronously, EXCEPT for the four exchange/
  // completion codes which always send immediately as discrete emails.
  // /api/cron/send-milestone-digests drains every 5 minutes: N=1 sends
  // the row's payload as-is (today's locked single-event copy); N>=2
  // assembles a digest (see lib/email/milestone-digest.ts). vendorAgent
  // + progressor sends below remain synchronous — those are internal-
  // audience and would change the working contract if deferred.
  const sideLog = new Map<"vendor" | "purchaser", { ids: string[]; subject: string; text: string }>();

  for (const c of tx.contacts) {
    if (!c.email || !c.portalToken) continue;
    const recipientKey = c.roleType as "vendor" | "purchaser";
    // Skip the first-actor side on inverse-direction bilateral completions.
    if (suppressedRecipient && recipientKey === suppressedRecipient) continue;
    const copy = resolveRecipientCopy(milestoneCode, recipientKey, effectiveEmailCopy, fileShape);
    if (!copy) continue;

    const greeting = buildGreeting(c.name);
    const vars     = { address, eventDate: eventDateVar, eventDateClause, attendClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote };
    const portalUrl = `${base}/portal/${c.portalToken}/progress`;

    const html = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: portalUrl, progressorName, progressorEmail, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, attendClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote } });
    const subject = interpolate(copy.subject, vars);
    const text = [greeting, "", interpolate(copy.opening, vars), "", interpolate(copy.whatHappened, vars), ...(copy.whatNext ? ["", interpolate(copy.whatNext, vars)] : []), "", `${copy.action ?? "View your portal"}: ${portalUrl}`].join("\n");

    // Empty-body guard — belt-and-braces against shape-conditional blocks
    // whose sections all gate out (e.g. VM9.purchaser on freehold if auto-
    // NR were ever bypassed). assembleEmail returns empty strings in that
    // case; resolveRecipientCopy returns a truthy object with empty fields;
    // without this guard an empty-bodied email would enqueue/send.
    if (!subject.trim() && !interpolate(copy.opening, vars).trim() && !interpolate(copy.whatHappened, vars).trim()) {
      continue;
    }

    // 2026-08-09 review-tray change: exchange/completion no longer
    // bypass the queue. They now enqueue with a SHORTER 60-second
    // delay (vs the 5-minute standard window) so the agent's review
    // tray still gets a chance to intercept a mis-timed exchange
    // notification, but clients still get near-realtime confirmation
    // of these big-deal moments. Staleness suppression preserved — if
    // suppressed, we skip enqueue entirely.
    if (customerSuppressedByStaleness) {
      // Nothing to enqueue; sideLog + logAutomatedEmail still fire so
      // the comms feed records the intent (matches prior behaviour).
      if (isExchangeCompletion) {
        const existing = sideLog.get(recipientKey);
        if (existing) {
          existing.ids.push(c.id);
        } else {
          sideLog.set(recipientKey, { ids: [c.id], subject, text });
        }
      }
    } else {
      // Enqueue path — used for every code now. Source key
      // (transactionId, milestoneCode) is unique per confirmation and
      // stable under retry. The unique index on (emailType, sourceId,
      // recipientContactId) makes the enqueue idempotent; a re-confirm
      // within the window silently no-ops. Delay differs per code:
      // exchange/completion = 60s (still discrete-feeling), everything
      // else = 5 minutes (batching window for the review tray).
      const sourceId = `${transactionId}:${milestoneCode}`;
      const payload: MilestoneDigestPayload = {
        subject,
        text,
        html,
        milestoneCode,
        recipientSide: recipientKey,
        address,
        firstName: extractFirstName(c.name),
        portalUrl,
      };
      const delayMs = isExchangeCompletion ? 60 * 1000 : 5 * 60 * 1000;
      enqueueEmail({
        emailType: "MILESTONE_CONFIRMATION",
        sourceId,
        recipientEmail: c.email,
        recipientContactId: c.id,
        payload: payload as unknown as Record<string, unknown>,
        // NOT routed through scheduleForBusinessHours — transactional
        // client emails fire 24/7 within the batching window.
        scheduledFor: new Date(Date.now() + delayMs),
      }).catch(() => {});
      // Queue path does NOT write to sideLog. The comms-log entry is
      // written by drainMilestoneDigests at send-time so the activity
      // feed records the actual body that landed (single or digest)
      // rather than the per-event intent at confirm-time.
    }
  }

  // sideLog only contains the exchange/completion synchronous-send
  // entries — the queue path logs at drain-time, not here.
  for (const { ids, subject, text } of sideLog.values()) {
    logAutomatedEmail(transactionId, ids, subject, text).catch(() => {});
  }

  // Agent notification — only on outsourced files; self-managed agents manage their own files
  const skipAgentEmail = serviceType === "self_managed";
  const vendorAgentCopy = resolveRecipientCopy(milestoneCode, "vendorAgent", effectiveEmailCopy, fileShape);
  if (tx.agentUser?.email && vendorAgentCopy && !skipAgentEmail) {
    const copy    = vendorAgentCopy;
    const vars    = { address, eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote };
    const greeting = buildGreeting(tx.agentUser.name);
    const html    = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: false, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote } });
    const subject = interpolate(copy.subject, vars);
    const text    = [greeting, "", interpolate(copy.whatHappened, vars)].join("\n");
    sendEmail({ to: tx.agentUser.email, subject, text, html, replyTo }).catch(() => {});
  }

  // Progressor notification — BUG2: suppress self-notification on outsourced when SP is the confirmer
  const skipProgressorEmail = serviceType === "outsourced" && tx.assignedUser?.id === confirmerId;
  const progressorCopy = resolveRecipientCopy(milestoneCode, "progressor", effectiveEmailCopy, fileShape);
  if (tx.assignedUser?.email && progressorCopy && !skipProgressorEmail) {
    const copy    = progressorCopy;
    const vars    = { address, eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote };
    const greeting = buildGreeting(tx.assignedUser.name);
    const html    = richMilestoneEmailHtml({ greeting, copy, address, ctaUrl: dashUrl, progressorName, progressorEmail, isProgressor: true, serviceType, extraVars: { eventDate: eventDateVar, eventDateClause, purchaserPhysicalNote, vendorVisitNote, completionDate: completionDateVar, surveyorClause, valuationNote } });
    const subject = interpolate(copy.subject, vars);
    const text    = [greeting, "", interpolate(copy.whatHappened, vars), `View: ${dashUrl}`].join("\n");
    sendEmail({ to: tx.assignedUser.email, subject, text, html, replyTo }).catch(() => {});
  }

  return true;
}

// ── Completion-pack timing + scheduling ───────────────────────────────────
//
// The "what to expect on completion day" pack (practicals: meters, keys,
// insurance handover) fires on EXCHANGE confirmation (VM19/PM26) but is
// timed to land 3 days before the recorded completion date — so the
// prep content arrives when it's actually useful.
//
// Per decideCompletionPackTiming in lib/services/exchange-completion-rules.ts:
//   completion in past         → skip entirely
//   completion ≤ 3 days        → send now (E2)
//   no completion date         → send now (E3 — tick is source of truth)
//   completion > 3 days away   → schedule for completionDate - 3 days (E1)
//
// Agent operational email is NOT in this function — it fires from the
// normal sendRichMilestoneEmails fan-out via VM19.vendorAgent (the
// pre-existing delegation in sendAdminMilestoneNotificationToPortal
// was removed on 2026-05-29; the FINAL VM19 skeleton + legacy fallback
// now reach the agent through the standard path).

type CompletionPackContact = {
  id: string;
  name: string;
  email: string;
  portalToken: string | null;
};

function renderCompletionPackBody(args: {
  side: "vendor" | "purchaser";
  contact: CompletionPackContact;
  address: string;
  completionDate: Date | null;
  // null when no specific agent name is known. Templates use a "{name} or
  // a member of our team" lead when the name is set, and "a member of our
  // team" alone when it isn't, so the fallback never produces the
  // "a member of our team or a member of our team" redundancy the old
  // string fallback used to render.
  agentName: string | null;
}): { subject: string; text: string; html: string; recipientEmail: string } {
  const { side, contact, address, completionDate, agentName } = args;
  const base = process.env.NEXTAUTH_URL ?? "";
  const completionStr = completionDate
    ? new Date(completionDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  // Completion is a SEPARATE sentence — never glued to "exchanged on", or the
  // completion date reads as the exchange date. (Bug fix 2026-08-11.)
  const completionSentenceHtml = completionStr ? ` Completion is set for <strong>${completionStr}</strong>.` : "";
  const completionSentencePlain = completionStr ? ` Completion is set for ${completionStr}.` : "";
  const portalUrl = contact.portalToken ? `${base}/portal/${contact.portalToken}` : base;

  // Concrete-agent prefix ("Emily or ") only when we have a real name;
  // otherwise we just say "a member of our team" on its own.
  const teamRef = agentName ? `${agentName} or a member of our team` : "a member of our team";

  const bodyHtml = side === "vendor"
    ? `
    <p>Contracts have been exchanged on <strong>${address}</strong>. The sale is now legally committed.${completionSentenceHtml}</p>
    <p style="margin-top:16px"><strong>What to expect on completion day:</strong></p>
    <ul style="padding-left:20px;line-height:2">
      <li>Your solicitor will handle the transfer of funds. You don't need to be at the property.</li>
      <li>Read all utility meters (gas, electricity, water) before you leave for the last time.</li>
      <li>Leave all keys, fobs, security codes, and gate remotes at the property (or hand to ${teamRef}).</li>
      <li>Leave appliance manuals, warranties, and service records. The buyer is entitled to these.</li>
      <li>Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.</li>
    </ul>`
    : `
    <p>Contracts have been exchanged on <strong>${address}</strong>. Your purchase is now legally committed.${completionSentenceHtml}</p>
    <p style="margin-top:16px"><strong>What to expect on completion day:</strong></p>
    <ul style="padding-left:20px;line-height:2">
      <li>Keep your phone on. Your solicitor will call you when the funds have been transferred.</li>
      <li>Keys are usually available from midday, once your solicitor confirms completion. ${teamRef} will let you know.</li>
      <li>Read all utility meters (gas, electricity, water) when you arrive at the property.</li>
      <li>From today, the property is at your risk. If your buildings insurance isn't already in place, arrange it as soon as possible.</li>
      <li>Your solicitor will register your ownership at HM Land Registry after completion.</li>
    </ul>`;

  const bodyPlain = side === "vendor"
    ? `Contracts have been exchanged on ${address}. The sale is now legally committed.${completionSentencePlain}\n\nWhat to expect on completion day:\n- Your solicitor will handle the transfer of funds. You don't need to be at the property.\n- Read all utility meters (gas, electricity, water) before you leave for the last time.\n- Leave all keys, fobs, security codes, and gate remotes at the property (or hand to ${teamRef}).\n- Leave appliance manuals, warranties, and service records. The buyer is entitled to these.\n- Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.`
    : `Contracts have been exchanged on ${address}. Your purchase is now legally committed.${completionSentencePlain}\n\nWhat to expect on completion day:\n- Keep your phone on. Your solicitor will call you when the funds have been transferred.\n- Keys are usually available from midday, once your solicitor confirms completion. ${teamRef} will let you know.\n- Read all utility meters (gas, electricity, water) when you arrive at the property.\n- From today, the property is at your risk. If your buildings insurance isn't already in place, arrange it as soon as possible.\n- Your solicitor will register your ownership at HM Land Registry after completion.`;

  const subject = side === "vendor"
    ? `Contracts exchanged: what happens next for your sale`
    : `Contracts exchanged: what happens next for your purchase`;

  const greeting = buildGreeting(contact.name);
  const text = `${greeting}\n\n${bodyPlain}\n\nView your portal: ${portalUrl}`;
  const html = portalEmailHtml({
    greeting,
    body: bodyHtml,
    ctaText: "View your portal",
    ctaUrl: portalUrl,
  });

  return { subject, text, html, recipientEmail: contact.email };
}

async function loadCompletionPackContext(transactionId: string): Promise<{
  address: string;
  completionDate: Date | null;
  agentName: string | null;
  vendors: CompletionPackContact[];
  purchasers: CompletionPackContact[];
} | null> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      completionDate: true,
      agentUser: { select: { name: true } },
      contacts: {
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return null;
  const narrow = (c: typeof tx.contacts[number]): CompletionPackContact | null =>
    c.email ? { id: c.id, name: c.name, email: c.email, portalToken: c.portalToken } : null;
  const vendors    = tx.contacts.filter((c) => c.roleType === "vendor")   .map(narrow).filter((c): c is CompletionPackContact => c !== null);
  const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser").map(narrow).filter((c): c is CompletionPackContact => c !== null);
  return {
    address: tx.propertyAddress,
    completionDate: tx.completionDate,
    agentName: tx.agentUser?.name ?? null,
    vendors,
    purchasers,
  };
}

// Sends the completion-pack to vendor + purchaser contacts NOW. Used by
// scheduleOrSendCompletionPack for E2 (completion ≤3 days away) and E3
// (no completion date). Comms-log entries written per side.
async function sendCustomerCompletionPackNow(transactionId: string): Promise<void> {
  const ctx = await loadCompletionPackContext(transactionId);
  if (!ctx) return;

  const vendorIds: string[] = [];
  let vendorPlainForLog = "";
  for (const c of ctx.vendors) {
    const body = renderCompletionPackBody({ side: "vendor", contact: c, address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    await sendEmail({ to: body.recipientEmail, subject: body.subject, text: body.text, html: body.html }).catch(() => {});
    vendorIds.push(c.id);
    if (!vendorPlainForLog) vendorPlainForLog = body.text;
  }
  if (vendorIds.length > 0) {
    logAutomatedEmail(transactionId, vendorIds, `Contracts exchanged: what happens next for your sale`, vendorPlainForLog).catch(() => {});
  }

  const purchaserIds: string[] = [];
  let purchaserPlainForLog = "";
  for (const c of ctx.purchasers) {
    const body = renderCompletionPackBody({ side: "purchaser", contact: c, address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    await sendEmail({ to: body.recipientEmail, subject: body.subject, text: body.text, html: body.html }).catch(() => {});
    purchaserIds.push(c.id);
    if (!purchaserPlainForLog) purchaserPlainForLog = body.text;
  }
  if (purchaserIds.length > 0) {
    logAutomatedEmail(transactionId, purchaserIds, `Contracts exchanged: what happens next for your purchase`, purchaserPlainForLog).catch(() => {});
  }
}

// Enqueues the completion-pack for delivery at scheduledFor. Used by
// scheduleOrSendCompletionPack for E1 (completion > 3 days away). Each
// contact gets its own OutboundEmailQueue row with the pre-rendered
// payload; the existing hourly /api/cron/drain-outbound-email cron
// picks them up at scheduledFor and sends via sendChainEmail.
async function enqueueCustomerCompletionPack(transactionId: string, milestoneCode: string, scheduledFor: Date): Promise<void> {
  const ctx = await loadCompletionPackContext(transactionId);
  if (!ctx) return;

  const sourceIdBase = `${transactionId}:${milestoneCode}`;
  for (const c of ctx.vendors) {
    const body = renderCompletionPackBody({ side: "vendor", contact: c, address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    await enqueueEmail({
      emailType: "COMPLETION_PACK",
      sourceId: sourceIdBase,
      recipientEmail: body.recipientEmail,
      recipientContactId: c.id,
      payload: { subject: body.subject, text: body.text, html: body.html },
      scheduledFor,
    }).catch(() => {});
  }
  for (const c of ctx.purchasers) {
    const body = renderCompletionPackBody({ side: "purchaser", contact: c, address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    await enqueueEmail({
      emailType: "COMPLETION_PACK",
      sourceId: sourceIdBase,
      recipientEmail: body.recipientEmail,
      recipientContactId: c.id,
      payload: { subject: body.subject, text: body.text, html: body.html },
      scheduledFor,
    }).catch(() => {});
  }

  // Comms-log entry written at enqueue time. The drain will actually
  // send at scheduledFor; the timeline shows the intent immediately.
  // (Same convention as MILESTONE_CONFIRMATION enqueue logging.)
  const vendorIds = ctx.vendors.map((c) => c.id);
  const purchaserIds = ctx.purchasers.map((c) => c.id);
  if (vendorIds.length > 0) {
    const sampleBody = renderCompletionPackBody({ side: "vendor", contact: ctx.vendors[0], address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    logAutomatedEmail(transactionId, vendorIds, `Contracts exchanged: what happens next for your sale`, sampleBody.text).catch(() => {});
  }
  if (purchaserIds.length > 0) {
    const sampleBody = renderCompletionPackBody({ side: "purchaser", contact: ctx.purchasers[0], address: ctx.address, completionDate: ctx.completionDate, agentName: ctx.agentName });
    logAutomatedEmail(transactionId, purchaserIds, `Contracts exchanged: what happens next for your purchase`, sampleBody.text).catch(() => {});
  }
}

// Public entry-point: from the agent or portal exchange-confirm path,
// schedule (E1), send-now (E2/E3), or skip (past completion).
export async function scheduleOrSendCompletionPack(transactionId: string, milestoneCode: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { completionDate: true },
  });
  if (!tx) return;
  const decision = decideCompletionPackTiming(tx.completionDate);
  switch (decision.action) {
    case "skip":
      return;
    case "send-now":
      return sendCustomerCompletionPackNow(transactionId);
    case "schedule":
      return enqueueCustomerCompletionPack(transactionId, milestoneCode, decision.scheduledFor);
  }
}

// Public entry-point: for the four auto-completing exchange/completion
// codes (VM19, PM26, VM20, PM27), the auto-counterpart's DB row is
// completed in the same prisma.$transaction as the primary, but the
// counterpart's email never fired before 2026-05-29. This helper runs
// the standard fan-out for the counterpart, so the other side gets
// their customer-facing email exactly once.
//
// For non-auto-counterpart codes, returns immediately — safe to call
// unconditionally from the confirm paths.
export async function fireAutoCounterpartEmails(
  transactionId: string,
  primaryCode: string,
  confirmerId?: string,
  confirmerRoute?: ConfirmerRoute,
): Promise<void> {
  const counterCode = AUTO_COUNTERPART_OF[primaryCode];
  if (!counterCode) return;
  const counterCopy = getMilestoneCopy(counterCode).emailCopy;
  if (!counterCopy) return;
  // handoffDirection undefined: these four codes aren't in BILATERAL_PAIR_OF
  // so they're not subject to PR 2 hand-off direction or its suppression.
  await sendRichMilestoneEmails(transactionId, counterCode, counterCopy, confirmerId, null, confirmerRoute, undefined);
}

export type TimelineEntry =
  | {
      type: "milestone";
      id: string;
      code: string;
      label: string;
      side: "vendor" | "purchaser";
      completedByName: string | null;
      completedByImage: string | null;
      confirmedBySolicitorFirmName: string | null;
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
    }
  | {
      type: "document";
      id: string;
      filename: string;
      mimeType: string;
      url: string | null;
      createdAt: Date;
    };

// Milestone codes that always appear in the timeline regardless of timeSensitive
const KEY_MILESTONE_CODES = new Set(["VM12", "PM16", "VM13", "PM17"]);

// Phase 1 commit 5 — round-scoped portal timeline.
//
// Vendor timeline:
//   - completions: ALL rounds (full file history)        → allRoundsForAudit()
//   - messages:    all visibleToClient on the file       (no round filter)
//
// Purchaser timeline:
//   - completions: vendor file-level VMs + OWN round PMs → forRound(ownRound, txId)
//   - messages:    addressed to this contact AND (file-level OR own round)
//                  — never the previous buyer's messages, never broadcasts
//                  scoped to a different round.
//
// The previous `_contactId` parameter was unused (headline relist privacy
// bug — a purchaser saw the file's full message log). It's now load-bearing.
export async function getPortalTimeline(
  transactionId: string,
  side: "vendor" | "purchaser",
  contactId: string,
  opts: { buyerRoundId: string | null; activeBuyerRoundId: string | null } = { buyerRoundId: null, activeBuyerRoundId: null },
): Promise<TimelineEntry[]> {
  return withRetry(async () => {
    const completionScope = side === "purchaser"
      ? milestoneScopeWhere(forRound(opts.buyerRoundId, transactionId))
      : {};
    const messageWhere = side === "purchaser"
      ? {
          transactionId,
          visibleToClient: true,
          contactIds: { has: contactId },
          OR: [
            { buyerRoundId: null },
            { buyerRoundId: opts.buyerRoundId },
          ],
        }
      : { transactionId, visibleToClient: true };
    // Documents: a client only ever sees uploads from their OWN side, never the
    // other party's. A purchaser is further scoped to their own buyer round so a
    // previous buyer's uploads can't leak. Agent / file-level uploads (no
    // contact) stay internal — they never carry a client-role contact, so the
    // roleType filter excludes them.
    const documentWhere = side === "purchaser"
      ? { transactionId, contact: { roleType: "purchaser" as const }, buyerRoundId: opts.buyerRoundId }
      : { transactionId, contact: { roleType: "vendor" as const } };
    const [completions, updates, documents] = await Promise.all([
      prisma.milestoneCompletion.findMany({
        // Enquiries rework: never surface the retired granular enquiry steps to a
        // client. Migrated in-flight files still carry completed rows for them,
        // so filter here (the definition-driven reads filter already; this is a
        // raw-completion feed and must too).
        where: {
          transactionId,
          state: "complete",
          milestoneDefinition: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
          ...completionScope,
        },
        include: {
          milestoneDefinition: { select: { code: true, side: true } },
          completedBy: { select: { name: true, image: true } },
          confirmedBySolicitorFirm: { select: { name: true } },
        },
        orderBy: { completedAt: "desc" },
      }),
      prisma.outboundMessage.findMany({
        where: messageWhere,
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, method: true, createdAt: true },
      }),
      prisma.transactionDocument.findMany({
        where: documentWhere,
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, mimeType: true, storagePath: true, createdAt: true },
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
          code: c.milestoneDefinition.code,
          label,
          side: c.milestoneDefinition.side as "vendor" | "purchaser",
          completedByName: c.completedBy?.name ?? null,
          completedByImage: c.completedBy?.image ?? null,
          confirmedBySolicitorFirmName: c.confirmedBySolicitorFirm?.name ?? null,
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

    const { getSignedUrl } = await import("@/lib/supabase-storage");
    const documentEntries: TimelineEntry[] = await Promise.all(
      documents.map(async (d) => ({
        type: "document" as const,
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        url: await getSignedUrl(d.storagePath, 3600).catch(() => null),
        createdAt: d.createdAt,
      })),
    );

    const all = [...milestoneEntries, ...updateEntries, ...documentEntries];
    all.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return all;
  });
}

// Only these codes may be marked not-required by the client, with their cascades
const PORTAL_NOT_REQUIRED_WHITELIST: Record<string, string[]> = {
  PM9: ["PM10"],
};

// Survey quotes this buyer has already requested. Distinct firm names (a buyer
// can request from several firms in one go) + the most recent submit, so the
// portal can acknowledge the request instead of re-offering it. Scoped to the
// contact's own id — token already resolved upstream.
export async function getPortalSurveyQuotes(
  contactId: string,
): Promise<{
  firmNames: string[];
  lastQuotedAt: Date | null;
  bookedFirmName: string | null;
  bookedAt: Date | null;
}> {
  const rows = await prisma.quoteRequest.findMany({
    where: { contactId },
    select: { submittedAt: true, status: true, bookedAt: true, provider: { select: { name: true } } },
    orderBy: { submittedAt: "desc" },
  });
  // The firm the buyer actually booked (still "booked" or already "won").
  const booked = rows.find((r) => r.status === "booked" || r.status === "won");
  return {
    firmNames: [...new Set(rows.map((r) => r.provider.name))],
    lastQuotedAt: rows[0]?.submittedAt ?? null,
    bookedFirmName: booked?.provider.name ?? null,
    bookedAt: booked?.bookedAt ?? null,
  };
}

export async function portalMarkNotRequired(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, name: true, roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  // Phase 1 commit 5 — dead-round guard. Mirrors portalCompleteMilestone.
  const txForGuard = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { activeBuyerRoundId: true },
  });
  if (!txForGuard) throw new Error("Invalid transaction");
  if (
    contact.roleType === "purchaser" &&
    contact.buyerRoundId != null &&
    contact.buyerRoundId !== txForGuard.activeBuyerRoundId
  ) {
    throw new Error("Invalid token");
  }

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

  // Phase 1 commit 5 — round attribution for find + create branches.
  //
  // PORTAL_NOT_REQUIRED_WHITELIST today only carries PM9 (cascading PM10),
  // both purchaser-side. The roundForStamp is the contact's buyerRoundId;
  // future entries on the vendor side would stamp null (vendor file-level).
  // The find query uses milestoneScopeWhere(roundScope) so a purchaser
  // can't update or read the previous round's PM9/PM10 row.
  const roundScope = contact.roleType === "purchaser"
    ? forRound(contact.buyerRoundId, txId)
    : vendorOnly();
  const roundForStamp = contact.roleType === "purchaser" ? contact.buyerRoundId : null;

  // Primary + cascade in one $transaction so the find→(update|create)
  // for every row is atomic; the partial unique index catches concurrent
  // races. Replaces two prisma.milestoneCompletion.upsert calls whose
  // compound key was dropped in Phase 1 commit 1.
  await prisma.$transaction(async (ptx) => {
    const primaryExisting = await ptx.milestoneCompletion.findFirst({
      where: {
        transactionId: txId,
        milestoneDefinitionId: def.id,
        ...milestoneScopeWhere(roundScope),
      },
      select: { id: true },
    });
    if (primaryExisting) {
      await ptx.milestoneCompletion.update({
        where: { id: primaryExisting.id },
        data: { state: "not_required", notRequiredReason: "Marked not required by client via portal", completedAt: null },
      });
    } else {
      await ptx.milestoneCompletion.create({
        data: {
          transactionId: txId,
          milestoneDefinitionId: def.id,
          state: "not_required",
          notRequiredReason: "Marked not required by client via portal",
          // Phase 1 commit 5 Pin 1 — stamp the round so newly-created
          // not-required rows are attributable to the right buyer.
          buyerRoundId: roundForStamp,
        },
      });
    }

    if (cascadeCodes.length > 0) {
      const cascadeDefs = await ptx.milestoneDefinition.findMany({
        where: { code: { in: cascadeCodes }, side },
        select: { id: true },
      });
      for (const cd of cascadeDefs) {
        const cascadeExisting = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: txId,
            milestoneDefinitionId: cd.id,
            ...milestoneScopeWhere(roundScope),
          },
          select: { id: true },
        });
        if (cascadeExisting) {
          await ptx.milestoneCompletion.update({
            where: { id: cascadeExisting.id },
            data: { state: "not_required", notRequiredReason: "Cascade: not required (survey skipped via portal)", completedAt: null },
          });
        } else {
          await ptx.milestoneCompletion.create({
            data: {
              transactionId: txId,
              milestoneDefinitionId: cd.id,
              state: "not_required",
              notRequiredReason: "Cascade: not required (survey skipped via portal)",
              // Phase 1 commit 5 Pin 1 — cascade rows inherit the same round.
              buyerRoundId: roundForStamp,
            },
          });
        }
      }
    }
  });
}

// Undo a portal "not required" (today: the survey, PM9 cascading PM10). Deletes
// only the not_required completion rows so the steps return to their natural
// available state — the client changed their mind. Mirrors the guards +
// round-scoping of portalMarkNotRequired.
export async function portalUnmarkNotRequired(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  const txForGuard = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { activeBuyerRoundId: true },
  });
  if (!txForGuard) throw new Error("Invalid transaction");
  if (
    contact.roleType === "purchaser" &&
    contact.buyerRoundId != null &&
    contact.buyerRoundId !== txForGuard.activeBuyerRoundId
  ) {
    throw new Error("Invalid token");
  }

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const def = await prisma.milestoneDefinition.findFirst({
    where: { id: input.milestoneDefinitionId, side },
    select: { id: true, code: true },
  });
  if (!def) throw new Error("Milestone not found");

  const cascadeCodes = PORTAL_NOT_REQUIRED_WHITELIST[def.code];
  if (!cascadeCodes) throw new Error("Cannot change this milestone from the portal");

  const txId = contact.propertyTransactionId;
  const roundScope = contact.roleType === "purchaser" ? forRound(contact.buyerRoundId, txId) : vendorOnly();

  await prisma.$transaction(async (ptx) => {
    await ptx.milestoneCompletion.deleteMany({
      where: { transactionId: txId, milestoneDefinitionId: def.id, state: "not_required", ...milestoneScopeWhere(roundScope) },
    });
    if (cascadeCodes.length > 0) {
      const cascadeDefs = await ptx.milestoneDefinition.findMany({
        where: { code: { in: cascadeCodes }, side },
        select: { id: true },
      });
      for (const cd of cascadeDefs) {
        await ptx.milestoneCompletion.deleteMany({
          where: { transactionId: txId, milestoneDefinitionId: cd.id, state: "not_required", ...milestoneScopeWhere(roundScope) },
        });
      }
    }
  });
}

// Survey skip state for the menu's "Getting a survey" toggle. Buyers only —
// PM9 is the single client-skippable step. `skipped` is true when PM9 is
// currently marked not_required for this buyer's round.
export async function getPortalSurveyState(token: string): Promise<{ applicable: boolean; skipped: boolean; definitionId: string | null }> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  if (!contact || contact.roleType !== "purchaser") return { applicable: false, skipped: false, definitionId: null };

  const pm9 = await prisma.milestoneDefinition.findFirst({ where: { code: "PM9", side: "purchaser" }, select: { id: true } });
  if (!pm9) return { applicable: false, skipped: false, definitionId: null };

  const roundScope = forRound(contact.buyerRoundId, contact.propertyTransactionId);
  const comp = await prisma.milestoneCompletion.findFirst({
    where: { transactionId: contact.propertyTransactionId, milestoneDefinitionId: pm9.id, ...milestoneScopeWhere(roundScope) },
    select: { state: true },
  });
  return { applicable: true, skipped: comp?.state === "not_required", definitionId: pm9.id };
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

// Phase 1 commit 5 — round-scoped. Same rule as getPortalTimeline's message
// arm: vendor sees all visibleToClient on the file; purchaser sees only
// messages addressed to them, scoped to file-level or their own round.
export async function getPortalUpdates(
  transactionId: string,
  side: "vendor" | "purchaser",
  contactId: string,
  opts: { buyerRoundId: string | null } = { buyerRoundId: null },
): Promise<PortalUpdate[]> {
  const where = side === "purchaser"
    ? {
        transactionId,
        visibleToClient: true,
        contactIds: { has: contactId },
        OR: [{ buyerRoundId: null }, { buyerRoundId: opts.buyerRoundId }],
      }
    : { transactionId, visibleToClient: true };
  return withRetry(() => prisma.outboundMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, method: true, createdAt: true },
  }));
}
