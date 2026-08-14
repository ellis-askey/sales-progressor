import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { detectPhase } from "@/lib/services/fees";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";

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
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below. Archived-
      // round PMs no longer inflate milestonePercent or hasExchanged on
      // a relisted file.
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: { not: DRAFT } })) },
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
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinitionId: { in: exchangeDefIds },
          OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: "active" as TransactionStatus })),
        },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      agentFeeAmount: true,
      photoStoragePath: true,
      agency:       { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
      vendorSolicitorFirm:    { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
      milestoneCompletions: {
        where: {
          state: "complete",
          milestoneDefinitionId: { in: allPostExchangeDefIds },
          OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: "active" as TransactionStatus })),
        },
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
        photoStoragePath: tx.photoStoragePath,
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

// Recently COMPLETED files (status flipped to "completed" when both VM20 + PM27
// were confirmed). Powers the collapsed "Completed" history on /agent/completions.
// Newest completion first, capped — the page shows the 3 most recent and lets
// the rest expand, so a busy agency never gets an endless page.
export async function getAgentCompletedFiles(vis: AgentVisibility, limit = 25) {
  const rows = await prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: "completed" },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      agentFeeAmount: true,
      photoStoragePath: true,
      agency:       { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
    },
    orderBy: { completionDate: "desc" },
    take: limit,
  });
  return rows.map((tx) => ({
    id: tx.id,
    propertyAddress: tx.propertyAddress,
    completionDate: tx.completionDate,
    purchasePrice: tx.purchasePrice,
    agentFeeAmount: tx.agentFeeAmount,
    photoStoragePath: tx.photoStoragePath,
    agencyName:       tx.agency?.name ?? null,
    assignedUserName: tx.assignedUser?.name ?? null,
    purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
  }));
}

// PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
// Comms dashboard activity feed: a relisted file's archived-round PM
// no longer appears as recent activity. The two-step pattern (load
// active round ids first, then filter MC.buyerRoundId IN that set OR
// NULL) replaces the prior cross-tx under-scope.
export async function getAgentMilestoneActivity(
  vis: AgentVisibility,
  portalOnly = false,
) {
  const txFilter = { ...txWhere(vis), status: { not: DRAFT } };
  const activeRoundIds = await loadActiveRoundIds(txFilter);
  return prisma.milestoneCompletion.findMany({
    where: {
      transaction: txFilter,
      state: "complete",
      // Enquiries rework: keep the retired granular enquiry steps out of the
      // agent activity feed (migrated files still carry their completed rows).
      milestoneDefinition: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
      OR: roundScopedOR(activeRoundIds),
      ...(portalOnly ? { confirmedByPortal: true } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 150,
    include: {
      transaction: {
        select: {
          id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, status: true,
          // id + image added for the client-confirmer avatar (audit #16 phase 2).
          contacts: { select: { id: true, name: true, roleType: true, image: true } },
        },
      },
      milestoneDefinition: { select: { code: true, name: true, side: true } },
      completedBy: { select: { name: true, image: true } },
      confirmedBySolicitorFirm: { select: { name: true } },
    },
  });
}

// Per-file snapshot for the Updates feed's right column: weight-based
// completion %, the human stage, and the next available step. Round-scoped to
// each file's active buyer round (mirrors the file page), computed for all
// feed files in a couple of batched queries.
export type FileSnapshot = { percent: number; stage: string; nextAction: string | null };

const SNAPSHOT_STAGE_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  conveyancing: "Conveyancing",
  pre_exchange: "Nearing exchange",
  post_exchange: "Post-exchange",
};

export async function getFileSnapshots(
  vis: AgentVisibility,
  txIds: string[],
): Promise<Map<string, FileSnapshot>> {
  const result = new Map<string, FileSnapshot>();
  const ids = [...new Set(txIds)];
  if (ids.length === 0) return result;

  const activeRoundIds = await loadActiveRoundIds({ ...txWhere(vis), id: { in: ids } });
  const defs = await prisma.milestoneDefinition.findMany({
    // Enquiries rework: exclude retired steps so a stale "available" retired row
    // on a migrated file can't be surfaced as the file's next action.
    where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
    select: { id: true, code: true, name: true, side: true, weight: true, orderIndex: true },
    orderBy: [{ orderIndex: "asc" }],
  });
  const defById = new Map(defs.map((d) => [d.id, d]));
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: { in: ids }, OR: roundScopedOR(activeRoundIds) },
    select: { transactionId: true, milestoneDefinitionId: true, state: true },
  });

  type Row = { code: string; name: string; side: string; weight: number; orderIndex: number; state: string };
  const byTx = new Map<string, Row[]>();
  for (const c of completions) {
    const d = defById.get(c.milestoneDefinitionId);
    if (!d) continue;
    const arr = byTx.get(c.transactionId) ?? [];
    arr.push({ code: d.code, name: d.name, side: d.side, weight: Number(d.weight), orderIndex: d.orderIndex, state: c.state });
    byTx.set(c.transactionId, arr);
  }

  const sidePercent = (rows: Row[]): number => {
    const applicable = rows.filter((r) => r.state !== "not_required");
    const total = applicable.reduce((s, r) => s + r.weight, 0);
    if (total === 0) return 0;
    const done = applicable.filter((r) => r.state === "complete").reduce((s, r) => s + r.weight, 0);
    return (done / total) * 100;
  };

  for (const id of ids) {
    const rows = byTx.get(id) ?? [];
    const percent = Math.round((sidePercent(rows.filter((r) => r.side === "vendor")) + sidePercent(rows.filter((r) => r.side === "purchaser"))) / 2);
    const completedCodes = new Set(rows.filter((r) => r.state === "complete").map((r) => r.code));
    const stage = SNAPSHOT_STAGE_LABEL[detectPhase(completedCodes).fileLevelPhase] ?? "In progress";
    const next = rows.filter((r) => r.state === "available").sort((a, b) => a.orderIndex - b.orderIndex)[0];
    result.set(id, { percent, stage, nextAction: next?.name ?? null });
  }
  return result;
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
