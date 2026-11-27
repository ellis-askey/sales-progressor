// Per-business network card stats, computed from the business's own transactions
// (PropertyTransaction.progressionBusinessId is the access boundary).
//
// Design (2026-11-27, founder-agreed):
//  - COMPLETION RATE is sale-based, not round-based: of a business's RESOLVED
//    sales (reached exchange, or withdrawn without ever exchanging), the share
//    that reached exchange. A sale that lost a buyer and was then rescued to
//    exchange counts as a WIN — rescuing fall-throughs is the progressor's job,
//    so we don't penalise it. (The old round-based rate counted every archived
//    buyer round as a fall-through, which unfairly dragged rates down.)
//  - TIME TO EXCHANGE is only trustworthy for files that ran start-to-finish on
//    the platform. Imported/migrated files carry a createdAt that is the import
//    date, not the real "sale agreed" date. Beyond the isMigrated /
//    claimedInProgress exclusions we drop spans outside a plausible conveyancing
//    window, which catches imports the flags missed.
//  - WARM-UP: a business shows performance stats only once it has enough CLEAN
//    resolved sales; below that the card shows "building a verified track record"
//    rather than thin, misleading figures — so an established business that is new
//    to the platform (or a genuine newcomer) never shows a bad number.
//
// Genuine data only; insufficient-data metrics come back null.

import { prisma } from "@/lib/prisma";
import type { ProgressorCardStats } from "@/lib/services/progressor-network";

const DAY = 86_400_000;
// A business needs this many clean, resolved sales before ANY performance stat
// shows. Tunable.
const WARMUP_MIN_RESOLVED = 8;
// Plausible conveyancing window for a real time-to-exchange — a genuine sale
// neither exchanges in under ~3 weeks nor takes over a year. Drops import noise.
const TIME_FLOOR_DAYS = 21;
const TIME_CEIL_DAYS = 365;
// Don't publish an average time from fewer than this many clean spans.
const MIN_TIME_FILES = 5;

function emptyStats(teamSize: number): ProgressorCardStats {
  return { completionRatePct: null, exchangedFiles12mo: null, avgTimeToExchangeWeeks: null, teamSize };
}

/**
 * Compute the card stats for each business id. Returns a map keyed by business
 * id; ids below the warm-up threshold come back with null metrics (+ real team
 * size) so the card shows the "building a track record" state.
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
      select: { progressionBusinessId: true, createdAt: true, exchangedAt: true, status: true },
    }),
  ]);

  const teamByBiz = new Map<string, number>();
  for (const t of teamCounts) {
    if (t.progressionBusinessId) teamByBiz.set(t.progressionBusinessId, t._count);
  }

  type Acc = { completions: number; abandoned: number; cleanSpans: number[]; exchanged12mo: number };
  const acc = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { completions: 0, abandoned: 0, cleanSpans: [], exchanged12mo: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const tx of txs) {
    const id = tx.progressionBusinessId;
    if (!id) continue;
    const a = ensure(id);

    if (tx.exchangedAt) {
      // Reached exchange — a win, regardless of how many buyers it took.
      a.completions += 1;
      if (new Date(tx.exchangedAt) >= twelveMonthsAgo) a.exchanged12mo += 1;
      const days = Math.round((new Date(tx.exchangedAt).getTime() - new Date(tx.createdAt).getTime()) / DAY);
      if (days >= TIME_FLOOR_DAYS && days <= TIME_CEIL_DAYS) a.cleanSpans.push(days);
    } else if (tx.status === "withdrawn") {
      // Died without ever exchanging — the only thing counted against the rate.
      a.abandoned += 1;
    }
    // active / on_hold / draft with no exchange yet are in-flight — not resolved.
  }

  for (const id of businessIds) {
    const teamSize = teamByBiz.get(id) ?? 0;
    const a = acc.get(id);
    if (!a) {
      out.set(id, emptyStats(teamSize));
      continue;
    }

    const resolved = a.completions + a.abandoned;
    // Warm-up gate — no performance stats until there's a real platform track record.
    if (resolved < WARMUP_MIN_RESOLVED) {
      out.set(id, emptyStats(teamSize));
      continue;
    }

    const avgDays =
      a.cleanSpans.length >= MIN_TIME_FILES
        ? Math.round(a.cleanSpans.reduce((x, y) => x + y, 0) / a.cleanSpans.length)
        : null;

    out.set(id, {
      completionRatePct: Math.round((a.completions / resolved) * 100),
      exchangedFiles12mo: a.exchanged12mo,
      avgTimeToExchangeWeeks: avgDays != null ? Math.max(1, Math.round(avgDays / 7)) : null,
      teamSize,
    });
  }

  return out;
}
