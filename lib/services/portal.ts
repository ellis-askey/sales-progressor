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

  // Notify assigned progressor by email
  if (tx.assignedUser?.email) {
    await sendEmail({
      to: tx.assignedUser.email,
      subject: `Portal viewed: ${tx.propertyAddress}`,
      text: `${content}\n\nView file: ${process.env.NEXTAUTH_URL}/transactions/${contact.propertyTransactionId}`,
    }).catch(() => {});
  }
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
      assignedUser: { select: { id: true, email: true } },
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

  if (tx.assignedUser.email) {
    await sendEmail({
      to: tx.assignedUser.email,
      subject: `Client confirmed milestone: ${tx.propertyAddress}`,
      text: `${content}\n\nView file: ${process.env.NEXTAUTH_URL}/transactions/${transactionId}`,
    }).catch(() => {});
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
