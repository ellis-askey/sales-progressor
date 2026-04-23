import { prisma } from "@/lib/prisma";
import { extractPostcode } from "@/lib/services/property-intel";
import { sendEmail } from "@/lib/email";

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
      assignedUser: { select: { id: true } },
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
