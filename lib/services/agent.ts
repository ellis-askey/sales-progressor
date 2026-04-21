import { prisma } from "@/lib/prisma";

export async function getAgentTransactions(agentUserId: string) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true, isPostExchange: false, isExchangeGate: false },
    select: { id: true },
  });
  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16"] } },
    select: { id: true },
  });
  const completionDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM13", "PM17"] } },
    select: { id: true },
  });

  const blockingDefIds = new Set(defs.map((d) => d.id));
  const exchangeIds = new Set(exchangeDefs.map((d) => d.id));
  const completionIds = new Set(completionDefs.map((d) => d.id));

  const transactions = await prisma.propertyTransaction.findMany({
    where: { agentUserId },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true } },
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false },
        select: { milestoneDefinitionId: true },
      },
    },
  });

  return transactions.map((tx) => {
    const completedIds = new Set(tx.milestoneCompletions.map((c) => c.milestoneDefinitionId));
    const blockingDone = [...blockingDefIds].filter((id) => completedIds.has(id)).length;
    const milestonePercent = blockingDefIds.size > 0
      ? Math.round((blockingDone / blockingDefIds.size) * 100)
      : 0;
    const hasExchanged = [...exchangeIds].some((id) => completedIds.has(id));
    const hasCompleted = [...completionIds].some((id) => completedIds.has(id));
    const vendors = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
    const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);

    return {
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      serviceType: tx.serviceType,
      purchasePrice: tx.purchasePrice,
      expectedExchangeDate: tx.expectedExchangeDate,
      completionDate: tx.completionDate,
      assignedUser: tx.assignedUser,
      milestonePercent,
      hasExchanged,
      hasCompleted,
      vendors,
      purchasers,
      createdAt: tx.createdAt,
    };
  });
}

export async function getAgentStats(agentUserId: string) {
  const transactions = await getAgentTransactions(agentUserId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return {
    total: transactions.length,
    active: transactions.filter((t) => t.status === "active" && !t.hasExchanged).length,
    exchanged: transactions.filter((t) => t.hasExchanged && !t.hasCompleted).length,
    completed: transactions.filter((t) => t.hasCompleted || t.status === "completed").length,
    thisMonth: transactions.filter((t) => new Date(t.createdAt) >= startOfMonth).length,
    thisYear: transactions.filter((t) => new Date(t.createdAt) >= startOfYear).length,
    selfManaged: transactions.filter((t) => t.serviceType === "self_managed").length,
    outsourced: transactions.filter((t) => t.serviceType === "outsourced").length,
  };
}

export async function getAgentCompletions(agentUserId: string) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16", "VM13", "PM17"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM12" || d.code === "PM16").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM13" || d.code === "PM17").map((d) => d.id);

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agentUserId,
      status: "active",
      milestoneCompletions: {
        some: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: completionDefIds } },
        select: { id: true },
      },
    },
  });

  return candidates
    .filter((tx) => tx.milestoneCompletions.length === 0)
    .map((tx) => ({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      completionDate: tx.completionDate,
      purchasePrice: tx.purchasePrice,
      assignedUserName: tx.assignedUser?.name ?? null,
      purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
      vendors: tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name),
    }))
    .sort((a, b) => {
      if (!a.completionDate) return 1;
      if (!b.completionDate) return -1;
      return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime();
    });
}

export async function getAgentComms(agentUserId: string) {
  return prisma.communicationRecord.findMany({
    where: {
      transaction: { agentUserId },
      visibleToClient: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      transaction: { select: { id: true, propertyAddress: true } },
      createdBy: { select: { name: true } },
    },
  });
}
