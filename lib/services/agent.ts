import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";

// "draft" is added to the TransactionStatus enum — type cast until Prisma client regenerates
const DRAFT = "draft" as TransactionStatus;

export type AgentVisibility = {
  userId: string;
  agencyId: string;
  seeAll: boolean;
  firmName: string | null;
  // Internal staff modes — undefined for all agent (director/negotiator) callers.
  // "admin_all": see every transaction on the platform (admin role).
  // "assigned": see only transactions where assignedUserId = userId (sales_progressor).
  internalMode?: "admin_all" | "assigned";
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

/**
 * Resolve visibility for internal staff (admin, sales_progressor, viewer).
 * Synchronous — reads only from the session, no DB query.
 * admin (or hybrid SP via hasAdminPowers) → "admin_all": sees every transaction across all agencies.
 * sales_progressor / viewer → "assigned": sees transactions where assignedUserId = userId.
 */
export function resolveInternalVisibility(
  userId: string,
  role: string,
  hasAdminPowers: boolean = false,
): AgentVisibility {
  return {
    userId,
    agencyId: "",
    seeAll: false,
    firmName: null,
    internalMode: (role === "admin" || hasAdminPowers) ? "admin_all" : "assigned",
  };
}

/** Build the Prisma `where` clause for PropertyTransaction based on visibility. */
function txWhere(vis: AgentVisibility) {
  // Internal staff paths — checked first; agent callers have internalMode undefined.
  if (vis.internalMode === "admin_all") return { serviceType: "outsourced" as const };
  if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId };
  // Agent paths unchanged.
  if (vis.seeAll) {
    if (vis.firmName) {
      return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    }
    return { agencyId: vis.agencyId };
  }
  return { agentUserId: vis.userId };
}

export async function getAgentTransactions(vis: AgentVisibility) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
    select: { id: true },
  });
  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const completionDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM20", "PM27"] } },
    select: { id: true },
  });

  const blockingDefIds = new Set(defs.map((d) => d.id));
  const exchangeIds = new Set(exchangeDefs.map((d) => d.id));
  const completionIds = new Set(completionDefs.map((d) => d.id));

  const transactions = await prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: { not: DRAFT } },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, role: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      contacts: { select: { name: true, roleType: true } },
      // PHASE 1 (a)-CLASS UNDER-SCOPING — agent dashboard list view.
      // Cross-tx Prisma include limitation; archived round's PMs can
      // inflate milestonePercent and the hasExchanged signal on a
      // relisted file. Agent surface only — does not drive comms or
      // chase. exchangedAt-canonical principle still applies for the
      // hasExchanged check downstream. Phase 2 ticket.
      milestoneCompletions: {
        where: { state: "complete" },
        select: { milestoneDefinitionId: true, completedAt: true },
      },
    },
  });

  return transactions.map((tx) => {
    const completedIds = new Set(tx.milestoneCompletions.map((c) => c.milestoneDefinitionId));
    const exchangeCompletion = tx.milestoneCompletions.find((c) => exchangeIds.has(c.milestoneDefinitionId));
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
      exchangedAt: exchangeCompletion?.completedAt ?? null,
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
    where: { code: { in: ["VM19", "PM26", "VM20", "PM27"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM19" || d.code === "PM26").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM20" || d.code === "PM27").map((d) => d.id);

  const allPostExchangeDefIds = [...exchangeDefIds, ...completionDefIds];

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere(vis),
      status: "active",
      // PHASE 1 (a)-CLASS ACCEPTED: exchangedAt is the canonical
      // "is this file exchanged?" source of truth; the relist
      // precondition exchangedAt IS NULL means relisted files cannot
      // satisfy this some-filter anyway. Cross-tx Prisma limitation.
      milestoneCompletions: {
        some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      agentFeeAmount: true,
      agency:       { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
      vendorSolicitorFirm:    { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      // PHASE 1 (a)-CLASS ACCEPTED: post-exchange filter is gated by
      // the exchangedAt-canonical principle above.
      milestoneCompletions: {
        where: { state: "complete", milestoneDefinitionId: { in: allPostExchangeDefIds } },
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
        agentFeeAmount: tx.agentFeeAmount,
        agencyName:       tx.agency?.name ?? null,
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

// PHASE 1 (a)-CLASS UNDER-SCOPING — accepted, documented:
// Cross-tx findMany with no parent-row reference available in the where
// clause; this is the Prisma per-tx scoping limitation. Consumer is
// app/agent/comms/page.tsx (agent comms dashboard activity feed,
// grouped by day). Agent-facing surface only: drives no chase or comms
// decisions, not client-visible, not billing-coupled. Post-relist, an
// archived round's PM completion can appear here as if it were recent
// activity on the file. This is the "inflated apparent progress"
// distortion the user flagged; accepted on the dashboard surface and
// flagged for Phase 2 restructure (two-step: list active tx ids + their
// activeBuyerRoundIds, then a per-tx scoped milestoneCompletion query).
export async function getAgentMilestoneActivity(
  vis: AgentVisibility,
  portalOnly = false,
) {
  return prisma.milestoneCompletion.findMany({
    where: {
      transaction: { ...txWhere(vis), status: { not: DRAFT } },
      state: "complete",
      ...(portalOnly ? { confirmedByPortal: true } : {}),
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
