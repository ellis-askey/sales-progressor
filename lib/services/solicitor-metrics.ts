// Phase-C performance metrics for ONE solicitor firm, scoped to the viewer's
// visible files. Every timing mirrors the exclusions the rest of analytics uses:
// migrated + claimed-in-progress files are dropped (their createdAt isn't a real
// agreed date), and only non-reconciled, active-round milestone completions
// count (catch-up completions carry the reconciliation moment, not the event).
// Genuine data only; insufficient-data states are returned as null / empty.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AgentVisibility } from "./agent";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";

const MIN_RESOLVED_ROUNDS = 5; // don't show an exchange rate below this
const STALLED_DAYS = 60;       // active + no movement this long → "stalled"

export type FirmMetric = { avgDays: number; n: number };
export type FirmTiming = { key: string; label: string; avgDays: number; n: number };
export type FirmTrendPoint = { month: string; avgDays: number; n: number };
// pct is null below MIN_RESOLVED_ROUNDS (shown as "not enough data" with the
// sample size); resolved/stalled are always returned.
export type FirmExchangeRate = { pct: number | null; resolved: number; stalled: number };

export type SolicitorFirmMetrics = {
  // Instruction (VM1) → draft pack issued (VM7). Seller-side.
  draftPack: FirmMetric | null;
  // Enquiries raised (PM14) → all satisfied (PM20). Buyer-side; whole loop.
  enquiries: FirmMetric | null;
  // Round-based: each buyer round classified exchange / fall-through / in-flight.
  exchangeRate: FirmExchangeRate;
  // Stage-by-stage bars (only stages with data are returned).
  timings: FirmTiming[];
  // Exchange time (created → exchange) bucketed by exchange month.
  trend: FirmTrendPoint[];
};

function visBaseWhere(vis: AgentVisibility): Prisma.PropertyTransactionWhereInput {
  return vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId }
    : { OR: [{ agentUserId: vis.userId }, { assignedUserId: vis.userId }] };
}

export async function getSolicitorFirmMetrics(vis: AgentVisibility, firmId: string): Promise<SolicitorFirmMetrics> {
  return firmMetricsFromWhere(visBaseWhere(vis), firmId);
}
export async function getSolicitorFirmMetricsForScope(scope: AccessScope, firmId: string): Promise<SolicitorFirmMetrics> {
  return firmMetricsFromWhere(scopeTransactionWhere(scope), firmId);
}

function avg(xs: number[]): number {
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}
// Day delta b−a, or null when either end is missing or the order is reversed
// (a reconciliation can land an "earlier" milestone after a later one).
function deltaDays(a: number | undefined, b: number | undefined): number | null {
  if (a == null || b == null || b < a) return null;
  return Math.round((b - a) / 86_400_000);
}

async function firmMetricsFromWhere(
  baseWhere: Prisma.PropertyTransactionWhereInput,
  firmId: string,
): Promise<SolicitorFirmMetrics> {
  const txWhere: Prisma.PropertyTransactionWhereInput = {
    ...baseWhere,
    isMigrated: false,
    claimedInProgress: false,
    OR: [{ vendorSolicitorFirmId: firmId }, { purchaserSolicitorFirmId: firmId }],
  };

  const [defs, activeRoundIds] = await Promise.all([
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM1", "VM7", "PM14", "PM20"] } },
      select: { id: true, code: true },
    }),
    loadActiveRoundIds(txWhere),
  ]);
  const codeByDef = new Map(defs.map((d) => [d.id, d.code] as const));
  const defIds = defs.map((d) => d.id);

  const txs = await prisma.propertyTransaction.findMany({
    where: txWhere,
    select: {
      id: true,
      createdAt: true,
      exchangedAt: true,
      status: true,
      lastActivityAt: true,
      buyerRounds: { select: { id: true, archivedAt: true } },
      milestoneCompletions: {
        where: {
          milestoneDefinitionId: { in: defIds },
          state: "complete",
          reconciledAtExchange: false,
          reconciledAtClaim: false,
          OR: roundScopedOR(activeRoundIds),
        },
        select: { milestoneDefinitionId: true, completedAt: true },
      },
    },
  });

  const draftPack: number[] = [];   // VM1 → VM7
  const enquiries: number[] = [];   // PM14 → PM20
  const barPackToEnq: number[] = []; // VM7 → PM14
  const barEnqToExch: number[] = []; // PM14 → exchange
  const trend = new Map<string, number[]>(); // YYYY-MM → [days]
  let exchanges = 0;
  let fallThroughs = 0;
  let stalled = 0;
  const now = Date.now();

  for (const tx of txs) {
    const at: Record<string, number | undefined> = {};
    for (const mc of tx.milestoneCompletions) {
      const code = codeByDef.get(mc.milestoneDefinitionId);
      if (code && mc.completedAt) at[code] = new Date(mc.completedAt).getTime();
    }
    const exch = tx.exchangedAt ? new Date(tx.exchangedAt).getTime() : undefined;

    const vm1vm7 = deltaDays(at.VM1, at.VM7);
    if (vm1vm7 != null) draftPack.push(vm1vm7);
    const pm14pm20 = deltaDays(at.PM14, at.PM20);
    if (pm14pm20 != null) enquiries.push(pm14pm20);
    const vm7pm14 = deltaDays(at.VM7, at.PM14);
    if (vm7pm14 != null) barPackToEnq.push(vm7pm14);
    const pm14exch = deltaDays(at.PM14, exch);
    if (pm14exch != null) barEnqToExch.push(pm14exch);

    // Trend: exchanged files only, bucketed by exchange month.
    if (exch != null) {
      const days = Math.round((exch - new Date(tx.createdAt).getTime()) / 86_400_000);
      if (days >= 0) {
        const dt = new Date(tx.exchangedAt!);
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
        const bucket = trend.get(key);
        if (bucket) bucket.push(days);
        else trend.set(key, [days]);
      }
    }

    // Round-based exchange rate: every archived (relisted-away) round is a
    // fall-through; the current round's outcome comes from the sale itself.
    fallThroughs += tx.buyerRounds.filter((r) => r.archivedAt != null).length;
    if (exch != null) {
      exchanges += 1;
    } else if (tx.status === "withdrawn") {
      fallThroughs += 1;
    } else if (
      (tx.status === "active" || tx.status === "on_hold") &&
      tx.lastActivityAt &&
      now - new Date(tx.lastActivityAt).getTime() > STALLED_DAYS * 86_400_000
    ) {
      stalled += 1; // in-flight, excluded from the rate, surfaced as a caveat
    }
  }

  const resolved = exchanges + fallThroughs;

  return {
    draftPack: draftPack.length ? { avgDays: avg(draftPack), n: draftPack.length } : null,
    enquiries: enquiries.length ? { avgDays: avg(enquiries), n: enquiries.length } : null,
    exchangeRate: {
      pct: resolved >= MIN_RESOLVED_ROUNDS ? Math.round((exchanges / resolved) * 100) : null,
      resolved,
      stalled,
    },
    timings: [
      { key: "instruction-draft", label: "Instruction to draft contract pack", xs: draftPack },
      { key: "draft-enquiries", label: "Draft contract pack to enquiries", xs: barPackToEnq },
      { key: "enquiries-exchange", label: "Enquiries to exchange", xs: barEnqToExch },
    ]
      .filter((t) => t.xs.length > 0)
      .map((t) => ({ key: t.key, label: t.label, avgDays: avg(t.xs), n: t.xs.length })),
    trend: [...trend.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, days]) => ({ month, avgDays: avg(days), n: days.length })),
  };
}
