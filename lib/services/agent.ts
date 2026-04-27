import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";

// "draft" is added to the TransactionStatus enum — type cast until Prisma client regenerates
const DRAFT = "draft" as TransactionStatus;

export type AgentVisibility = {
  userId: string;
  agencyId: string;
  seeAll: boolean;
  firmName: string | null;
};

/** Resolve how much of the agency a user can see based on role + canViewAllFiles. */
export async function resolveAgentVisibility(
  userId: string,
  agencyId: string
): Promise<AgentVisibility> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canViewAllFiles: true, firmName: true },
  });
  const seeAll = user?.role === "director" || user?.canViewAllFiles === true;
  return { userId, agencyId, seeAll, firmName: user?.firmName ?? null };
}

/** Build the Prisma `where` clause for PropertyTransaction based on visibility. */
function txWhere(vis: AgentVisibility) {
  if (vis.seeAll) {
    if (vis.firmName) {
      return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    }
    return { agentUserId: vis.userId };
  }
  return { agentUserId: vis.userId };
}

export async function getAgentTransactions(vis: AgentVisibility) {
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
    where: { ...txWhere(vis), status: { not: DRAFT } },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true } },
      agentUser: { select: { id: true, name: true } },
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
      agentUser: tx.agentUser,
      milestonePercent,
      hasExchanged,
      hasCompleted,
      vendors,
      purchasers,
      createdAt: tx.createdAt,
      agentFeeAmount: tx.agentFeeAmount,
      agentFeePercent: tx.agentFeePercent,
      agentFeeIsVatInclusive: tx.agentFeeIsVatInclusive,
      referredFirmId: tx.referredFirmId,
      referralFee: tx.referralFee,
      referralFeeReceived: tx.referralFeeReceived,
    };
  });
}

export async function getAgentStats(vis: AgentVisibility) {
  const transactions = await getAgentTransactions(vis);

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

export async function getAgentCompletions(vis: AgentVisibility) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16", "VM13", "PM17"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM12" || d.code === "PM16").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM13" || d.code === "PM17").map((d) => d.id);

  const allPostExchangeDefIds = [...exchangeDefIds, ...completionDefIds];

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere(vis),
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
      vendorSolicitorFirm:    { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: allPostExchangeDefIds } },
        select: { milestoneDefinitionId: true, completedAt: true },
      },
    },
  });

  return candidates
    .filter((tx) => !tx.milestoneCompletions.some((c) => completionDefIds.includes(c.milestoneDefinitionId)))
    .map((tx) => {
      const exchangeCompletion = tx.milestoneCompletions.find((c) => exchangeDefIds.includes(c.milestoneDefinitionId));
      return {
        id: tx.id,
        propertyAddress: tx.propertyAddress,
        completionDate: tx.completionDate,
        purchasePrice: tx.purchasePrice,
        assignedUserName: tx.assignedUser?.name ?? null,
        purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
        vendors:    tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name),
        exchangedAt:           exchangeCompletion?.completedAt ?? null,
        vendorSolicitorName:    tx.vendorSolicitorFirm?.name ?? null,
        purchaserSolicitorName: tx.purchaserSolicitorFirm?.name ?? null,
      };
    })
    .sort((a, b) => {
      if (!a.completionDate) return 1;
      if (!b.completionDate) return -1;
      return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime();
    });
}

export async function getAgentMilestoneActivity(
  vis: AgentVisibility,
  portalOnly = false,
) {
  return prisma.milestoneCompletion.findMany({
    where: {
      transaction: { ...txWhere(vis), status: { not: DRAFT } },
      isActive: true,
      isNotRequired: false,
      ...(portalOnly ? { statusReason: { contains: "via portal" } } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 150,
    include: {
      transaction: { select: { id: true, propertyAddress: true } },
      milestoneDefinition: { select: { name: true, side: true } },
      completedBy: { select: { name: true } },
    },
  });
}

export async function getDraftTransactions(vis: AgentVisibility) {
  return prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: DRAFT },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      propertyAddress: true,
      tenure: true,
      purchaseType: true,
      purchasePrice: true,
      updatedAt: true,
      contacts: { select: { name: true, phone: true, roleType: true } },
    },
  });
}

/** List all negotiators + director in an agency, scoped to firmName if provided. */
export async function getAgencyTeam(agencyId: string, firmName?: string | null) {
  const where: Record<string, unknown> = { agencyId, role: { in: ["director", "negotiator"] } };
  if (firmName) where.firmName = firmName;
  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}
