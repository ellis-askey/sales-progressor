import { prisma } from "@/lib/prisma";
import { extractPostcode } from "@/lib/services/property-intel";
import { sendEmail } from "@/lib/email";
import { pushToContact } from "@/lib/services/push";
import { getMilestoneCopy } from "@/lib/portal-copy";

// Mirror of DIRECT_PREREQUISITES from milestones.ts — only the immediate
// predecessors that must be complete before a milestone is available to confirm.
const DIRECT_PREREQUISITES: Record<string, string[]> = {
  VM2: ["VM1"], VM3: ["VM1"], VM14: ["VM1"], VM15: ["VM1"],
  VM4: ["VM15"], VM5: ["VM4"], VM6: ["VM5"], VM7: ["VM6"],
  VM16: ["VM5"], VM17: ["VM16"], VM8: ["VM17"],
  VM18: ["VM8"], VM19: ["VM18"], VM9: ["VM19"],
  VM10: ["VM5"], VM11: ["VM10"], VM20: ["VM11"],
  VM12: ["VM20"], VM13: ["VM12"],
  PM2: ["PM1"], PM14a: ["PM1"], PM15a: ["PM14a"],
  PM4: ["PM1"], PM5: ["PM4"], PM6: ["PM5"],
  PM7: ["PM1"],
  PM9: ["PM3"], PM20: ["PM7"], PM8: ["PM3"],
  PM10: ["PM9"], PM11: ["PM10"], PM21: ["PM11"],
  PM22: ["PM21"], PM12: ["PM22"], PM23: ["PM12"],
  PM24: ["PM23"], PM25: ["PM24"], PM26: ["PM25"],
  PM13: ["PM26"], PM14b: ["PM13"], PM15b: ["PM14b"],
  PM27: ["PM15b"], PM16: ["PM27"], PM17: ["PM16"],
};

export type PortalMilestone = {
  id: string;
  code: string;
  name: string;
  side: string;
  orderIndex: number;
  blocksExchange: boolean;
  isPostExchange: boolean;
  isExchangeGate: boolean;
  timeSensitive: boolean;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
  eventDate: Date | null;
  completedAt: Date | null;
  confirmedByClient: boolean;
};

export type PortalUpdate = {
  id: string;
  content: string;
  createdAt: Date;
  method: string | null;
};

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
        agencyName: tx.agency.name,
        postcode,
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
      where: { transactionId, isActive: true },
    });

    const completionMap = new Map(completions.map((c) => [c.milestoneDefinitionId, c]));
    const codeToId = new Map(defs.map((d) => [d.code, d.id]));

    return defs.map((def) => {
      const comp = completionMap.get(def.id) ?? null;
      const isComplete = comp ? !comp.isNotRequired : false;
      const isNotRequired = comp?.isNotRequired ?? false;

      const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
      const isAvailable = prereqCodes.every((code) => {
        const id = codeToId.get(code);
        if (!id) return true;
        const c = completionMap.get(id);
        return c && !c.isNotRequired;
      });

      return {
        id: def.id,
        code: def.code,
        name: def.name,
        side: def.side,
        orderIndex: def.orderIndex,
        blocksExchange: def.blocksExchange,
        isPostExchange: def.isPostExchange,
        isExchangeGate: def.isExchangeGate,
        timeSensitive: def.timeSensitive,
        isComplete,
        isNotRequired,
        isAvailable,
        eventDate: comp?.eventDate ?? null,
        completedAt: comp?.completedAt ?? null,
        confirmedByClient: comp?.statusReason === "Confirmed by client via portal",
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

  await prisma.communicationRecord.create({
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

  if (def.timeSensitive && !input.eventDate) {
    throw new Error("Date required for this milestone");
  }

  const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
  if (prereqCodes.length > 0) {
    const prereqDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes }, side },
      select: { id: true, code: true },
    });
    for (const prereq of prereqDefs) {
      const done = await prisma.milestoneCompletion.findFirst({
        where: {
          transactionId: contact.propertyTransactionId,
          milestoneDefinitionId: prereq.id,
          isActive: true,
          isNotRequired: false,
        },
      });
      if (!done) throw new Error(`Complete "${prereq.code}" first`);
    }
  }

  await prisma.milestoneCompletion.updateMany({
    where: { transactionId: contact.propertyTransactionId, milestoneDefinitionId: input.milestoneDefinitionId, isActive: true },
    data: { isActive: false },
  });

  const completion = await prisma.milestoneCompletion.create({
    data: {
      transactionId: contact.propertyTransactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      isActive: true,
      isNotRequired: false,
      completedAt: new Date(),
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      statusReason: "Confirmed by client via portal",
    },
  });

  logPortalMilestoneConfirm(
    contact.propertyTransactionId,
    contact.id,
    contact.name,
    def.name
  ).catch(() => {});

  if (def.code === "VM12" || def.code === "PM16") {
    sendExchangeCompletionPack(contact.propertyTransactionId).catch(() => {});
  }

  return completion;
}

export async function logPortalMilestoneConfirm(
  transactionId: string,
  contactId: string,
  contactName: string,
  milestoneLabel: string
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      contacts: {
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx?.assignedUser) return;

  const content = `${contactName} confirmed "${milestoneLabel}" via the client portal`;

  await prisma.communicationRecord.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [contactId],
      content,
      createdById: tx.assignedUser.id,
    },
  });

  // Notify the assigned progressor immediately
  if (tx.assignedUser.email) {
    const dashUrl = `${process.env.NEXTAUTH_URL ?? ""}/transactions/${transactionId}`;
    sendEmail({
      to: tx.assignedUser.email,
      subject: `Client confirmed: "${milestoneLabel}" — ${tx.propertyAddress}`,
      text: [
        `Hi ${tx.assignedUser.name.split(" ")[0]},`,
        "",
        `${contactName} has just confirmed "${milestoneLabel}" on ${tx.propertyAddress} via their portal.`,
        "",
        `View file: ${dashUrl}`,
      ].join("\n"),
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 20px;font-size:15px">Hi ${tx.assignedUser.name.split(" ")[0]},</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px">
  <p style="margin:0 0 4px;font-size:13px;color:#8b91a3">${tx.propertyAddress}</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#1a1d29">${contactName} confirmed "${milestoneLabel}"</p>
</div>
<p><a href="${dashUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View file</a></p>
</body></html>`,
    }).catch(() => {});
  }

  const base = process.env.NEXTAUTH_URL ?? "";
  const confirmingContact = tx.contacts.find((c) => c.id === contactId);
  const confirmingRole = confirmingContact?.roleType;

  // Thank-you email to the confirming client
  if (confirmingContact?.email && confirmingContact.portalToken) {
    const portalUrl = `${base}/portal/${confirmingContact.portalToken}`;
    await sendEmail({
      to: confirmingContact.email,
      subject: `Thank you — "${milestoneLabel}" confirmed`,
      text: [
        `Hi ${confirmingContact.name},`,
        ``,
        `Thank you for confirming "${milestoneLabel}" for ${tx.propertyAddress}.`,
        `Your conveyancing is moving forward.`,
        ``,
        `View your portal to see the full progress: ${portalUrl}`,
      ].join("\n"),
      html: portalEmailHtml({
        greeting: `Hi ${confirmingContact.name},`,
        body: `Thank you for confirming <strong>"${milestoneLabel}"</strong> for <strong>${tx.propertyAddress}</strong>. Your conveyancing is moving forward.`,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
  }

  // Notification email to the other side
  const otherSideRole = confirmingRole === "vendor" ? "purchaser" : "vendor";
  const otherContacts = tx.contacts.filter(
    (c) => c.id !== contactId && c.roleType === otherSideRole && c.email && c.portalToken
  );
  for (const other of otherContacts) {
    const portalUrl = `${base}/portal/${other.portalToken!}`;
    await sendEmail({
      to: other.email!,
      subject: `Progress update — ${tx.propertyAddress}`,
      text: [
        `Hi ${other.name},`,
        ``,
        `There has been a progress update on your transaction at ${tx.propertyAddress}.`,
        ``,
        `${confirmingContact?.name ?? contactName} has confirmed "${milestoneLabel}".`,
        ``,
        `View your portal to see the full progress: ${portalUrl}`,
      ].join("\n"),
      html: portalEmailHtml({
        greeting: `Hi ${other.name},`,
        body: `There has been a progress update on your transaction at <strong>${tx.propertyAddress}</strong>.<br><br>${confirmingContact?.name ?? contactName} has confirmed <strong>"${milestoneLabel}"</strong>.`,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
  }

  // Push notifications — confirming contact gets a "step recorded" confirmation;
  // other vendor/purchaser contacts get a "progress update" ping
  if (confirmingContact?.portalToken) {
    pushToContact(contactId, {
      title: "Step confirmed",
      body: `"${milestoneLabel}" has been recorded. Your transaction is progressing.`,
      url: `${base}/portal/${confirmingContact.portalToken}/progress`,
    }).catch(() => {});
  }

  const otherPushContacts = tx.contacts.filter(
    (c) => c.id !== contactId && (c.roleType === "vendor" || c.roleType === "purchaser") && c.portalToken
  );
  for (const other of otherPushContacts) {
    pushToContact(other.id, {
      title: "Progress update",
      body: `${confirmingContact?.name ?? contactName} confirmed "${milestoneLabel}".`,
      url: `${base}/portal/${other.portalToken!}/progress`,
    }).catch(() => {});
  }
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

async function sendExchangeCompletionPack(transactionId: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      completionDate: true,
      contacts: {
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
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
      <li>Leave all keys, fobs, security codes, and gate remotes at the property (or hand to your agent).</li>
      <li>Leave appliance manuals, warranties, and service records — the buyer is entitled to these.</li>
      <li>Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.</li>
    </ul>`;
  const vendorBodyPlain = `Contracts have been exchanged on ${address}${datePlain}. The sale is now legally committed.\n\nWhat to expect on completion day:\n- Your solicitor will handle the transfer of funds — you don't need to be at the property.\n- Read all utility meters (gas, electricity, water) before you leave for the last time.\n- Leave all keys, fobs, security codes, and gate remotes at the property (or hand to your agent).\n- Leave appliance manuals, warranties, and service records — the buyer is entitled to these.\n- Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.`;

  const purchaserBodyHtml = `
    <p>Contracts have been exchanged on <strong>${address}</strong>${dateBlurb}. Your purchase is now legally committed.</p>
    <p style="margin-top:16px"><strong>What to expect on completion day:</strong></p>
    <ul style="padding-left:20px;line-height:2">
      <li>Keep your phone on — your solicitor will call you when the funds have been transferred.</li>
      <li>Keys are usually available from midday, once your solicitor confirms completion. Your agent will let you know.</li>
      <li>Read all utility meters (gas, electricity, water) when you arrive at the property.</li>
      <li>Make sure your buildings insurance is active from today — you are now legally the owner.</li>
      <li>Your solicitor will register your ownership at HM Land Registry after completion.</li>
    </ul>`;
  const purchaserBodyPlain = `Contracts have been exchanged on ${address}${datePlain}. Your purchase is now legally committed.\n\nWhat to expect on completion day:\n- Keep your phone on — your solicitor will call you when the funds have been transferred.\n- Keys are usually available from midday, once your solicitor confirms completion. Your agent will let you know.\n- Read all utility meters (gas, electricity, water) when you arrive at the property.\n- Make sure your buildings insurance is active from today — you are now legally the owner.\n- Your solicitor will register your ownership at HM Land Registry after completion.`;

  for (const c of vendors) {
    const portalUrl = c.portalToken ? `${base}/portal/${c.portalToken}` : base;
    await sendEmail({
      to: c.email!,
      subject: `Contracts exchanged — what happens next for your sale`,
      text: `Hi ${c.name},\n\n${vendorBodyPlain}\n\nView your portal: ${portalUrl}`,
      html: portalEmailHtml({
        greeting: `Hi ${c.name},`,
        body: vendorBodyHtml,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
  }

  for (const c of purchasers) {
    const portalUrl = c.portalToken ? `${base}/portal/${c.portalToken}` : base;
    await sendEmail({
      to: c.email!,
      subject: `Contracts exchanged — what happens next for your purchase`,
      text: `Hi ${c.name},\n\n${purchaserBodyPlain}\n\nView your portal: ${portalUrl}`,
      html: portalEmailHtml({
        greeting: `Hi ${c.name},`,
        body: purchaserBodyHtml,
        ctaText: "View your portal",
        ctaUrl: portalUrl,
      }),
    }).catch(() => {});
  }
}

export type TimelineEntry =
  | {
      type: "milestone";
      id: string;
      label: string;
      completedByName: string | null;
      confirmedByClient: boolean;
      createdAt: Date;
    }
  | {
      type: "update";
      id: string;
      content: string;
      method: string | null;
      createdAt: Date;
    }
  | {
      type: "message";
      id: string;
      content: string;
      fromClient: boolean;
      sentByName: string | null;
      createdAt: Date;
    };

export async function getPortalTimeline(
  transactionId: string,
  side: "vendor" | "purchaser",
  contactId: string
): Promise<TimelineEntry[]> {
  return withRetry(async () => {
    const [completions, updates, messages] = await Promise.all([
      prisma.milestoneCompletion.findMany({
        where: { transactionId, isActive: true, isNotRequired: false },
        include: {
          milestoneDefinition: { select: { code: true, side: true } },
          completedBy: { select: { name: true } },
        },
        orderBy: { completedAt: "desc" },
      }),
      prisma.communicationRecord.findMany({
        where: { transactionId, visibleToClient: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, method: true, createdAt: true },
      }),
      prisma.portalMessage.findMany({
        where: { transactionId, contactId },
        include: { sentBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const milestoneEntries: TimelineEntry[] = completions
      .filter((c) => c.milestoneDefinition.side === side)
      .map((c) => ({
        type: "milestone" as const,
        id: c.id,
        label: getMilestoneCopy(c.milestoneDefinition.code).label,
        completedByName: c.completedBy?.name ?? null,
        confirmedByClient: c.statusReason === "Confirmed by client via portal",
        createdAt: c.completedAt,
      }));

    const updateEntries: TimelineEntry[] = updates.map((u) => ({
      type: "update" as const,
      id: u.id,
      content: u.content,
      method: u.method,
      createdAt: u.createdAt,
    }));

    const messageEntries: TimelineEntry[] = messages.map((m) => ({
      type: "message" as const,
      id: m.id,
      content: m.content,
      fromClient: m.fromClient,
      sentByName: m.fromClient ? null : (m.sentBy?.name ?? null),
      createdAt: m.createdAt,
    }));

    const all = [...milestoneEntries, ...updateEntries, ...messageEntries];
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return all;
  });
}

// Only these codes may be marked not-required by the client, with their cascades
const PORTAL_NOT_REQUIRED_WHITELIST: Record<string, string[]> = {
  PM7: ["PM20"],
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

  await prisma.milestoneCompletion.updateMany({
    where: { transactionId: txId, milestoneDefinitionId: def.id, isActive: true },
    data: { isActive: false },
  });
  await prisma.milestoneCompletion.create({
    data: {
      transactionId: txId,
      milestoneDefinitionId: def.id,
      isActive: true,
      isNotRequired: true,
      completedAt: now,
      statusReason: "Marked not required by client via portal",
    },
  });

  if (cascadeCodes.length > 0) {
    const cascadeDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: cascadeCodes }, side },
      select: { id: true },
    });
    for (const cd of cascadeDefs) {
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: txId, milestoneDefinitionId: cd.id, isActive: true },
        data: { isActive: false },
      });
      await prisma.milestoneCompletion.create({
        data: {
          transactionId: txId,
          milestoneDefinitionId: cd.id,
          isActive: true,
          isNotRequired: true,
          completedAt: now,
          statusReason: "Cascade: not required (survey skipped via portal)",
        },
      });
    }
  }
}

export async function getPortalViewDates(transactionId: string): Promise<Record<string, Date>> {
  const records = await prisma.communicationRecord.findMany({
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
  return withRetry(() => prisma.communicationRecord.findMany({
    where: { transactionId, visibleToClient: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, method: true, createdAt: true },
  }));
}
