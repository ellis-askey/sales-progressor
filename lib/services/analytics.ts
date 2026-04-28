import { prisma } from "@/lib/prisma";
import { calculateOurFee } from "@/lib/services/fees";
import type { AgentVisibility } from "./agent";
import type { Prisma } from "@prisma/client";

// ── Shared visibility where ───────────────────────────────────────────────────

function buildTxWhere(vis: AgentVisibility): Prisma.PropertyTransactionWhereInput {
  if (vis.seeAll) {
    return vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId, agentUserId: { not: null } };
  }
  return { agencyId: vis.agencyId, agentUserId: vis.userId };
}

export type MonthVolume = {
  month: string; // "Jan 25"
  created: number;
  completed: number;
  exchanged: number;
};

export type ProgressorStat = {
  name: string;
  active: number;
  completed: number;
  pipelineValue: number;
};

export type AnalyticsData = {
  totalActive: number;
  totalCompleted: number;
  totalWithdrawn: number;
  pipelineValue: number;
  ourFeesPipeline: number;
  ourFeesTxCount: number;
  agentFeesPipeline: number;
  agentFeesTxCount: number;
  avgDaysToExchange: number | null;
  monthlyVolume: MonthVolume[];
  progressorStats: ProgressorStat[];
  conversionRate: number | null;
};

export async function getAnalytics(agencyId: string): Promise<AnalyticsData> {
  const [transactions, exchangeDefs] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { agencyId },
      select: {
        id: true,
        status: true,
        purchasePrice: true,
        createdAt: true,
        completionDate: true,
        assignedUser: { select: { id: true, name: true, clientType: true, legacyFee: true } },
        agentFeeAmount: true,
        agentFeePercent: true,
        milestoneCompletions: {
          where: { state: "complete" },
          select: { milestoneDefinitionId: true, completedAt: true },
        },
      },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM19", "PM26"] } },
      select: { id: true },
    }),
  ]);

  const exchangeDefIds = new Set(exchangeDefs.map((d) => d.id));

  const active = transactions.filter((t) => t.status === "active");
  const completed = transactions.filter((t) => t.status === "completed");
  const withdrawn = transactions.filter((t) => t.status === "withdrawn");

  const pipelineValue = active.reduce((sum, t) => sum + (t.purchasePrice ?? 0), 0);

  // Our fee pipeline
  let ourFeesPipeline = 0;
  let ourFeesTxCount = 0;
  for (const t of active) {
    const { fee } = calculateOurFee(
      t.assignedUser?.clientType ?? "standard",
      t.assignedUser?.legacyFee ?? null,
      t.purchasePrice ?? null
    );
    if (fee !== null) { ourFeesPipeline += fee; ourFeesTxCount++; }
  }

  // Agent fee pipeline
  let agentFeesPipeline = 0;
  let agentFeesTxCount = 0;
  for (const t of active) {
    if (t.agentFeeAmount) {
      agentFeesPipeline += t.agentFeeAmount;
      agentFeesTxCount++;
    } else if (t.agentFeePercent && t.purchasePrice) {
      agentFeesPipeline += Math.round(Number(t.agentFeePercent) * t.purchasePrice / 100);
      agentFeesTxCount++;
    }
  }

  // Avg days to exchange: only completed/active files that have an exchange milestone
  const exchangeTimes: number[] = [];
  for (const tx of transactions) {
    const exchComp = tx.milestoneCompletions.find((c) => exchangeDefIds.has(c.milestoneDefinitionId));
    if (exchComp) {
      const days = Math.round(
        ((exchComp.completedAt ? new Date(exchComp.completedAt) : new Date()).getTime() - new Date(tx.createdAt).getTime()) / 86400000
      );
      if (days >= 0) exchangeTimes.push(days);
    }
  }
  const avgDaysToExchange =
    exchangeTimes.length > 0
      ? Math.round(exchangeTimes.reduce((a, b) => a + b, 0) / exchangeTimes.length)
      : null;

  // Monthly volume — last 12 months
  const now = new Date();
  const months: MonthVolume[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const start = d;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const monthCreated = transactions.filter(
      (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) < end
    ).length;

    const monthCompleted = transactions.filter(
      (t) =>
        t.status === "completed" &&
        t.completionDate &&
        new Date(t.completionDate) >= start &&
        new Date(t.completionDate) < end
    ).length;

    const monthExchanged = transactions.filter((t) =>
      t.milestoneCompletions.some(
        (c) => exchangeDefIds.has(c.milestoneDefinitionId) && c.completedAt && new Date(c.completedAt) >= start && new Date(c.completedAt) < end
      )
    ).length;

    months.push({ month: label, created: monthCreated, completed: monthCompleted, exchanged: monthExchanged });
  }

  // Per-progressor stats
  const progressorMap = new Map<string, ProgressorStat>();
  for (const tx of transactions) {
    const name = tx.assignedUser?.name ?? "Unassigned";
    if (!progressorMap.has(name)) {
      progressorMap.set(name, { name, active: 0, completed: 0, pipelineValue: 0 });
    }
    const s = progressorMap.get(name)!;
    if (tx.status === "active") { s.active++; s.pipelineValue += tx.purchasePrice ?? 0; }
    if (tx.status === "completed") s.completed++;
  }

  const conversionRate =
    transactions.length > 0
      ? Math.round((completed.length / transactions.length) * 100)
      : null;

  return {
    totalActive: active.length,
    totalCompleted: completed.length,
    totalWithdrawn: withdrawn.length,
    pipelineValue,
    ourFeesPipeline,
    ourFeesTxCount,
    agentFeesPipeline,
    agentFeesTxCount,
    avgDaysToExchange,
    monthlyVolume: months,
    progressorStats: Array.from(progressorMap.values()).sort((a, b) => b.active - a.active),
    conversionRate,
  };
}

export type ReferralStat = {
  firmId: string;
  firmName: string;
  referralCount: number;
  feeExpectedPence: number;
  feeReceivedPence: number;
  pendingCount: number;
};

export async function getReferralStats(agencyId: string): Promise<ReferralStat[]> {
  const rows = await prisma.propertyTransaction.findMany({
    where: { agencyId, referredFirmId: { not: null } },
    select: {
      referralFee: true,
      referralFeeReceived: true,
      referredFirm: { select: { id: true, name: true } },
    },
  });

  const map = new Map<string, ReferralStat>();
  for (const r of rows) {
    if (!r.referredFirm) continue;
    const existing = map.get(r.referredFirm.id) ?? {
      firmId: r.referredFirm.id,
      firmName: r.referredFirm.name,
      referralCount: 0,
      feeExpectedPence: 0,
      feeReceivedPence: 0,
      pendingCount: 0,
    };
    existing.referralCount++;
    existing.feeExpectedPence += r.referralFee ?? 0;
    if (r.referralFeeReceived) existing.feeReceivedPence += r.referralFee ?? 0;
    else existing.pendingCount++;
    map.set(r.referredFirm.id, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.referralCount - a.referralCount);
}

// ── Monthly activity (visibility-scoped, 12 months) ──────────────────────────

export type MonthlyActivityBucket = { month: string; created: number; exchanged: number };

export async function getMonthlyActivity(vis: AgentVisibility): Promise<MonthlyActivityBucket[]> {
  const txWhere = buildTxWhere(vis);
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const windowEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const exchangeDefIds = exchangeDefs.map((d) => d.id);

  const [txsInWindow, exchangesInWindow] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: txWhere,
        milestoneDefinitionId: { in: exchangeDefIds },
        state: "complete",
        completedAt: { gte: windowStart, lt: windowEnd },
      },
      select: { completedAt: true },
    }),
  ]);

  return Array.from({ length: 12 }, (_, idx) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const label = start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const created  = txsInWindow.filter(t  => { const d = new Date(t.createdAt);   return d >= start && d < end; }).length;
    const exchanged = exchangesInWindow.filter(e => { if (!e.completedAt) return false; const d = new Date(e.completedAt); return d >= start && d < end; }).length;
    return { month: label, created, exchanged };
  });
}

// ── Solicitor exchange performance ───────────────────────────────────────────

export type SolicitorExchangeStat = {
  firmId: string;
  firmName: string;
  exchangeCount: number;
  avgDaysToExchange: number;
};

export async function getSolicitorExchangeStats(vis: AgentVisibility): Promise<SolicitorExchangeStat[]> {
  const txWhere = buildTxWhere(vis);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16"] } },
    select: { id: true },
  });
  const exchangeDefIds = exchangeDefs.map((d) => d.id);

  const txs = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      OR: [{ vendorSolicitorFirmId: { not: null } }, { purchaserSolicitorFirmId: { not: null } }],
      milestoneCompletions: {
        some: { milestoneDefinitionId: { in: exchangeDefIds }, state: "complete" },
      },
    },
    select: {
      createdAt: true,
      vendorSolicitorFirm:    { select: { id: true, name: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      milestoneCompletions: {
        where: { milestoneDefinitionId: { in: exchangeDefIds }, state: "complete" },
        select: { completedAt: true },
        orderBy: { completedAt: "asc" },
        take: 1,
      },
    },
  });

  const firmMap = new Map<string, { firmId: string; firmName: string; times: number[] }>();

  for (const tx of txs) {
    const exchAt = tx.milestoneCompletions[0]?.completedAt;
    if (!exchAt) continue;
    const days = Math.round(
      (new Date(exchAt).getTime() - new Date(tx.createdAt).getTime()) / 86400000
    );
    if (days < 0) continue;
    for (const firm of [tx.vendorSolicitorFirm, tx.purchaserSolicitorFirm]) {
      if (!firm) continue;
      const s = firmMap.get(firm.id) ?? { firmId: firm.id, firmName: firm.name, times: [] };
      s.times.push(days);
      firmMap.set(firm.id, s);
    }
  }

  return Array.from(firmMap.values())
    .map(({ firmId, firmName, times }) => ({
      firmId,
      firmName,
      exchangeCount: times.length,
      avgDaysToExchange: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    }))
    .sort((a, b) => a.avgDaysToExchange - b.avgDaysToExchange);
}
