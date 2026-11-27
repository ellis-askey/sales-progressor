// Per-business network card stats, computed from the business's own transactions
// (PropertyTransaction.progressionBusinessId is the access boundary).
//
// Mirrors lib/services/solicitor-metrics.ts so the numbers read consistently with
// the rest of analytics: migrated + claimed-in-progress + demo files are dropped,
// the exchange rate is round-based (archived buyer rounds + withdrawals count as
// fall-throughs), and it stays null below a minimum resolved sample. Genuine data
// only — insufficient-data metrics come back null so a new business renders the
// "building track record" state rather than a fake figure.

import { prisma } from "@/lib/prisma";
import type { ProgressorCardStats } from "@/lib/services/progressor-network";

const MIN_RESOLVED = 5; // don't publish an exchange rate below this (mirrors solicitor-metrics)
const DAY = 86_400_000;

function emptyStats(teamSize: number): ProgressorCardStats {
  return { exchangeRatePct: null, exchangedFiles12mo: null, avgTimeToExchangeWeeks: null, teamSize };
}

/**
 * Compute the four network card stats for each business id. Returns a map keyed
 * by business id; ids with no qualifying transactions still get a row (null
 * metrics + their real team size) so new businesses render gracefully.
 */
export async function getNetworkStatsFor(businessIds: string[]): Promise<Map<string, ProgressorCardStats>> {
  const out = new Map<string, ProgressorCardStats>();
  if (businessIds.length === 0) return out;

  const twelveMonthsAgo = new Date(Date.now() - 365 * DAY);

  const [teamCounts, txs] = await Promise.all([
    prisma.user.groupBy({
      by: ["progressionBusinessId"],
      where: { progressionBusinessId: { in: businessIds }, deactivatedAt: null },
      _count: true,
    }),
    prisma.propertyTransaction.findMany({
      where: {
        progressionBusinessId: { in: businessIds },
        isMigrated: false,
        claimedInProgress: false,
        isDemo: false,
      },
      select: {
        progressionBusinessId: true,
        createdAt: true,
        exchangedAt: true,
        status: true,
        buyerRounds: { select: { archivedAt: true } },
      },
    }),
  ]);

  const teamByBiz = new Map<string, number>();
  for (const t of teamCounts) {
    if (t.progressionBusinessId) teamByBiz.set(t.progressionBusinessId, t._count);
  }

  type Acc = { exchanges: number; fallThroughs: number; exchangeDays: number[]; exchanged12mo: number };
  const acc = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { exchanges: 0, fallThroughs: 0, exchangeDays: [], exchanged12mo: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const tx of txs) {
    const id = tx.progressionBusinessId;
    if (!id) continue;
    const a = ensure(id);

    // Every archived (relisted-away) round is a fall-through.
    a.fallThroughs += tx.buyerRounds.filter((r) => r.archivedAt != null).length;

    if (tx.exchangedAt) {
      a.exchanges += 1;
      const days = Math.round((new Date(tx.exchangedAt).getTime() - new Date(tx.createdAt).getTime()) / DAY);
      if (days >= 0) a.exchangeDays.push(days);
      if (new Date(tx.exchangedAt) >= twelveMonthsAgo) a.exchanged12mo += 1;
    } else if (tx.status === "withdrawn") {
      a.fallThroughs += 1;
    }
    // active / on_hold with no exchange yet are in-flight — excluded from the rate.
  }

  for (const id of businessIds) {
    const teamSize = teamByBiz.get(id) ?? 0;
    const a = acc.get(id);
    if (!a) {
      out.set(id, emptyStats(teamSize));
      continue;
    }
    const resolved = a.exchanges + a.fallThroughs;
    const avgDays = a.exchangeDays.length
      ? Math.round(a.exchangeDays.reduce((x, y) => x + y, 0) / a.exchangeDays.length)
      : null;
    out.set(id, {
      exchangeRatePct: resolved >= MIN_RESOLVED ? Math.round((a.exchanges / resolved) * 100) : null,
      // A count: 0 is a real, truthful value (exchanged nothing in the window).
      exchangedFiles12mo: a.exchanged12mo,
      avgTimeToExchangeWeeks: avgDays != null ? Math.max(1, Math.round(avgDays / 7)) : null,
      teamSize,
    });
  }

  return out;
}
