import { prisma } from "@/lib/prisma";
import { calculateOurFee } from "@/lib/services/fees";
import type { AgentVisibility } from "./agent";
import type { Prisma, TransactionStatus } from "@prisma/client";

// "draft" exists in the DB enum but may not be in the generated Prisma client yet
const DRAFT = "draft" as TransactionStatus;

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

// ── KPI sparklines ────────────────────────────────────────────────────────────

export type KpiSparklines = {
  labels: string[];
  submitted: number[];  // transaction submitted count per weekly bucket
  exchanged: number[];  // distinct transactions that exchanged per bucket (event date)
  completed: number[];  // distinct transactions that completed per bucket (event date)
};

export async function getKpiTrendsForAgency(
  vis: AgentVisibility,
  range: { start: Date; end: Date }
): Promise<KpiSparklines> {
  const txWhere = buildTxWhere(vis);
  const rangeEnd = range.end;

  // 8 weekly buckets (oldest → newest), each 7 days, last ending at rangeEnd
  const buckets = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(rangeEnd);
    end.setDate(end.getDate() - (7 - i) * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
      start,
      end,
      label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    };
  });

  const windowStart = buckets[0].start;

  const [exchangeDefs, completionDefs] = await Promise.all([
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM19", "PM26"] } },
      select: { id: true },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM20", "PM27"] } },
      select: { id: true },
    }),
  ]);

  const exchangeDefIds = exchangeDefs.map((d) => d.id);
  const completionDefIds = completionDefs.map((d) => d.id);

  const [txsInWindow, exchangesInWindow, completionsInWindow] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, status: { not: DRAFT }, createdAt: { gte: windowStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
    // Exclude reconciledAtExchange completions — Fix 5 risk callout: sweep completions
    // added during bilateral exchange reconciliation corrupt trend counts.
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: { ...txWhere, status: { not: DRAFT } },
        milestoneDefinitionId: { in: exchangeDefIds },
        state: "complete",
        reconciledAtExchange: false,
        completedAt: { gte: windowStart, lt: rangeEnd },
      },
      select: { transactionId: true, completedAt: true },
    }),
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: { ...txWhere, status: { not: DRAFT } },
        milestoneDefinitionId: { in: completionDefIds },
        state: "complete",
        reconciledAtExchange: false,
        completedAt: { gte: windowStart, lt: rangeEnd },
      },
      select: { transactionId: true, completedAt: true },
    }),
  ]);

  // One event per transaction: keep earliest completedAt per transactionId
  const dedupByTx = (rows: { transactionId: string; completedAt: Date | null }[]): Date[] => {
    const map = new Map<string, Date>();
    for (const r of rows) {
      if (!r.completedAt) continue;
      const d = new Date(r.completedAt);
      const prev = map.get(r.transactionId);
      if (!prev || d < prev) map.set(r.transactionId, d);
    }
    return Array.from(map.values());
  };

  const exchangeDates   = dedupByTx(exchangesInWindow);
  const completionDates = dedupByTx(completionsInWindow);

  return {
    labels:    buckets.map((b) => b.label),
    submitted: buckets.map(({ start, end }) =>
      txsInWindow.filter((t) => { const d = new Date(t.createdAt); return d >= start && d < end; }).length
    ),
    exchanged: buckets.map(({ start, end }) =>
      exchangeDates.filter((d) => d >= start && d < end).length
    ),
    completed: buckets.map(({ start, end }) =>
      completionDates.filter((d) => d >= start && d < end).length
    ),
  };
}

// ── Submission funnel (pure helper — data is already computed in the page) ────

export type SubmissionFunnelData = {
  stages: Array<{ key: string; label: string; count: number }>;
  conversions: Array<{ from: string; to: string; percent: number }>;
};

export function buildSubmissionFunnel(
  submitted: number,
  exchanged: number,
  completed: number
): SubmissionFunnelData {
  return {
    stages: [
      { key: "submitted", label: "Submitted", count: submitted },
      { key: "exchanged", label: "Exchanged", count: exchanged },
      { key: "completed", label: "Completed", count: completed },
    ],
    conversions: [
      {
        from: "submitted",
        to: "exchanged",
        percent: submitted > 0 ? Math.round((exchanged / submitted) * 100) : 0,
      },
      {
        from: "exchanged",
        to: "completed",
        percent: exchanged > 0 ? Math.round((completed / exchanged) * 100) : 0,
      },
    ],
  };
}

// ── Avg days to exchange ──────────────────────────────────────────────────────

export type AvgDaysToExchangeData = {
  avgDays: number | null;
  count: number;
};

export async function getAvgDaysToExchange(
  vis: AgentVisibility,
  range: { start: Date; end: Date }
): Promise<AvgDaysToExchangeData> {
  const txWhere = buildTxWhere(vis);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transaction: { ...txWhere, status: { not: DRAFT } },
      milestoneDefinitionId: { in: exchangeDefs.map((d) => d.id) },
      state: "complete",
      reconciledAtExchange: false,
      completedAt: { gte: range.start, lt: range.end },
    },
    select: {
      transactionId: true,
      completedAt: true,
      transaction: { select: { createdAt: true } },
    },
  });

  const seen = new Set<string>();
  const diffs: number[] = [];
  for (const c of completions) {
    if (!c.completedAt || seen.has(c.transactionId)) continue;
    seen.add(c.transactionId);
    diffs.push(
      Math.round(
        (new Date(c.completedAt).getTime() - new Date(c.transaction.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  if (diffs.length === 0) return { avgDays: null, count: 0 };
  return {
    avgDays: Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length),
    count: diffs.length,
  };
}

// ── Files at risk ─────────────────────────────────────────────────────────────

export type FilesAtRiskData = {
  overdueChases:    { count: number; transactionIds: string[] };
  stalled:          { count: number; transactionIds: string[] };
  missingEventDate: { count: number; transactionIds: string[] };
};

export async function getFilesAtRisk(vis: AgentVisibility): Promise<FilesAtRiskData> {
  const txWhere = buildTxWhere(vis);
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const exchangeDefIds = exchangeDefs.map((d) => d.id);

  const [overdueChaseTasks, stalledTxs, missingEventDateTxs] = await Promise.all([
    // Pending chase tasks past their due date, on active files only
    prisma.chaseTask.findMany({
      where: {
        status: "pending",
        dueDate: { lt: now },
        transaction: { ...txWhere, status: "active" },
      },
      select: { transactionId: true },
    }),
    // Active, not yet exchanged, no milestone completed in the last 14 days
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        milestoneCompletions: {
          none: { state: "complete", completedAt: { gte: fourteenDaysAgo } },
        },
        NOT: {
          milestoneCompletions: {
            some: { milestoneDefinitionId: { in: exchangeDefIds }, state: "complete" },
          },
        },
      },
      select: { id: true },
    }),
    // Active files with a completed milestone that required an event date but has none set
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        milestoneCompletions: {
          some: {
            state: "complete",
            eventDate: null,
            milestoneDefinition: { eventDateRequired: true },
          },
        },
      },
      select: { id: true },
    }),
  ]);

  const overdueChaseIds = [...new Set(overdueChaseTasks.map((t) => t.transactionId))];

  return {
    overdueChases:    { count: overdueChaseIds.length,         transactionIds: overdueChaseIds.slice(0, 50) },
    stalled:          { count: stalledTxs.length,              transactionIds: stalledTxs.map((t) => t.id).slice(0, 50) },
    missingEventDate: { count: missingEventDateTxs.length,     transactionIds: missingEventDateTxs.map((t) => t.id).slice(0, 50) },
  };
}
