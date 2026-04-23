import { prisma } from "@/lib/prisma";

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
        assignedUser: { select: { id: true, name: true } },
        milestoneCompletions: {
          where: { isActive: true, isNotRequired: false },
          select: { milestoneDefinitionId: true, completedAt: true },
        },
      },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM12", "PM16"] } },
      select: { id: true },
    }),
  ]);

  const exchangeDefIds = new Set(exchangeDefs.map((d) => d.id));

  const active = transactions.filter((t) => t.status === "active");
  const completed = transactions.filter((t) => t.status === "completed");
  const withdrawn = transactions.filter((t) => t.status === "withdrawn");

  const pipelineValue = active.reduce((sum, t) => sum + (t.purchasePrice ?? 0), 0);

  // Avg days to exchange: only completed/active files that have an exchange milestone
  const exchangeTimes: number[] = [];
  for (const tx of transactions) {
    const exchComp = tx.milestoneCompletions.find((c) => exchangeDefIds.has(c.milestoneDefinitionId));
    if (exchComp) {
      const days = Math.round(
        (new Date(exchComp.completedAt).getTime() - new Date(tx.createdAt).getTime()) / 86400000
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
        (c) => exchangeDefIds.has(c.milestoneDefinitionId) && new Date(c.completedAt) >= start && new Date(c.completedAt) < end
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
