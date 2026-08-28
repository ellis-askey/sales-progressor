// lib/command/revenue.ts
//
// Founder-grade revenue dashboard data. Single helper returns everything the
// /command/revenue page renders in one Promise.all, so the page reads as a
// thin presentational component.
//
// Two surfaces:
//   - getRevenueDashboard(scope, now)        — main /command/revenue page
//   - getAgencyRevenueDetail(agencyId, now)  — /command/revenue/[agencyId] drill
//
// All fee math is delegated to lib/billing/fee.ts:computeFee, which is the
// single source of truth for the legacy override + sliding scale. Per-SP
// legacy fees (User.clientType='legacy') are ignored here — no prod user
// has that flag set, so introducing it would be dead code. If that ever
// becomes a real customer shape, add it to computeFee, not here.
//
// Internal/test agencies (Agency.isInternal=true) are excluded from every
// query so the founder's numbers reflect real customers only.

import { commandDb } from "@/lib/command/prisma";
import { computeFee, type AgencyFeeOverride, type VatInput } from "@/lib/billing/fee";
import { billingMonthRange, billingMonthStart } from "@/lib/billing/period";
import {
  calculatePhaseAwarePrediction,
  computeEffectiveStartDate,
  type PhaseAwareInput,
} from "@/lib/services/fees";
import type {
  AgencyModeProfile,
  ClientType,
  ServiceType,
  PurchaseType,
  Tenure,
} from "@prisma/client";
import type { CommandMode } from "@/lib/command/scope";

// ─── Public types ─────────────────────────────────────────────────────────────

export type RevenueScope = {
  mode: CommandMode;
  agencyIds: string[];
};

export type AgencyRevenueRow = {
  agencyId: string;
  name: string;
  modeProfile: AgencyModeProfile;
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
  vatRegisteredAt: Date | null;
  /** Active, non-withdrawn files belonging to this agency. */
  activeFileCount: number;
  /** Sum of fees on files this agency has exchanged in the current London month. */
  bankedThisMonthPence: number;
  bankedThisMonthCount: number;
  /** Sum of expected fees on this agency's active files predicted to exchange
   *  in the current London month. Uses calculatePhaseAwarePrediction live. */
  pipelineThisMonthPence: number;
  pipelineThisMonthCount: number;
  /** Sum of InvoiceLine.totalPence on issued/paid/failed invoices, all time. */
  lifetimeBilledPence: number;
  lastExchangeAt: Date | null;
  paymentFailedAt: Date | null;
  newFileCreationBlockedAt: Date | null;
};

export type ExchangeRow = {
  transactionId: string;
  propertyAddress: string;
  agencyId: string;
  agencyName: string;
  agencyFeeTier: ClientType;
  serviceType: ServiceType;
  priceAtExchangePence: number | null;
  feeTotalPence: number;
  feeBandLabel: string;
  exchangedAt: Date;
};

export type PipelineBucket = {
  totalPence: number;
  fileCount: number;
};

export type SimpleAgencyRef = {
  agencyId: string;
  name: string;
  flaggedAt: Date;
};

export type LegacyAgencyRef = {
  agencyId: string;
  name: string;
  legacyOutsourcedFeePence: number;
};

export type RevenueDashboardData = {
  asOf: Date;
  monthStart: Date;
  monthEnd: Date;
  scope: RevenueScope;
  /** Hero KPIs (cross-agency, scope-aware). banked = ACTUAL invoiced amount
   *  (frozen InvoiceLine), not a live recompute, so it can't drift if a fee
   *  changes after exchange. */
  banked: { totalPence: number; fileCount: number; agencyCount: number };
  /** Actual invoiced total for the PREVIOUS billing month — powers the trend. */
  bankedLastMonthPence: number;
  /** Sum of expected fees across EVERY active (non-exchanged, non-withdrawn)
   *  file in scope, regardless of predicted exchange date. The "total fee in
   *  pipeline" headline number. Includes files in this-month/next/after/later
   *  AND the at-risk bucket. */
  pipelineAllActive: PipelineBucket;
  pipelineThisMonth: PipelineBucket;
  forecastTotalThisMonth: { totalPence: number };
  trialValueThisMonth: { totalPence: number; fileCount: number };
  /** Pipeline outlook strip. */
  pipelineNextMonth: PipelineBucket;
  pipelineMonthAfter: PipelineBucket;
  /** Active files whose predicted exchange date is already in the past — i.e.
   *  the model says these should have exchanged already but they haven't. A
   *  cleaner signal than the multi-tier on_track/at_risk/off_track from
   *  calculateProgress, and doesn't need full milestone weight data. */
  pipelineAtRisk: PipelineBucket;
  /** Active files predicted to exchange beyond the +2-month window. Closes the
   *  gap between the headline book and the visible outlook cells. */
  pipelineLater: PipelineBucket;
  /** On-hold (paused) files' expected fees — kept out of the timed pipeline
   *  but part of the total book, in their own clearly-labelled bucket. */
  paused: PipelineBucket;
  /** Expected fees on active files predicted to exchange over the next 3 months
   *  (this + next + after). A rolling forecast, distinct from the this-month one. */
  threeMonthForecastPence: number;
  /** Active standard-agency files with no price entered, so their fee is
   *  estimated at the bottom (£250) band. Surfaced so the pipeline's assumptions
   *  are visible. */
  priceEstimatedCount: number;
  /** Where the money comes from — banked (actual) and pipeline (estimate) split
   *  by service type, fee tier, and agency mode. */
  breakdown: {
    bankedByServiceType: { inHousePence: number; outsourcedPence: number };
    pipelineByServiceType: { inHousePence: number; outsourcedPence: number };
    pipelineByTier: { legacyPence: number; standardPence: number };
    pipelineByMode: { spPence: number; pmPence: number; mixedPence: number };
  };
  /** Per-agency table (the bible). */
  perAgency: AgencyRevenueRow[];
  /** Last 20 billed exchanges across the scope, with the fee label that
   *  computeFee assigned at the time of read (legacy agencies show "Outsourced
   *  — legacy fixed fee"). */
  recentExchanges: ExchangeRow[];
  /** Outstanding + risk sub-cards. */
  buildingInvoices: { invoiceCount: number; totalPence: number };
  failedPayments: SimpleAgencyRef[];
  blockedAgencies: SimpleAgencyRef[];
  /** Legend at the bottom of the page — generated live from feeTier=legacy. */
  legacyAgencies: LegacyAgencyRef[];
  /** Provider referral income (surveyors/brokers) — a separate stream from our
   *  own sale fees. Earned on won quotes; collected when marked paid. */
  referralIncome: { earnedPence: number; collectedPence: number; outstandingPence: number; wonCount: number };
};

export type AgencyRevenueDetailData = {
  asOf: Date;
  monthStart: Date;
  monthEnd: Date;
  agency: {
    id: string;
    name: string;
    modeProfile: AgencyModeProfile;
    feeTier: ClientType;
    legacyOutsourcedFeePence: number | null;
    vatRegisteredAt: Date | null;
    vatRateBps: number | null;
    paymentFailedAt: Date | null;
    newFileCreationBlockedAt: Date | null;
    firstSubmissionAt: Date | null;
    stripeCustomerId: string | null;
    createdAt: Date;
  };
  banked: { totalPence: number; fileCount: number };
  pipelineAllActive: PipelineBucket;
  pipelineThisMonth: PipelineBucket;
  pipelineNextMonth: PipelineBucket;
  pipelineMonthAfter: PipelineBucket;
  pipelineAtRisk: PipelineBucket;
  lifetimeBilledPence: number;
  trialValueLifetimePence: number;
  trialExchangeCountLifetime: number;
  recentExchanges: ExchangeRow[];
  activeFiles: ActiveFileRow[];
};

export type ActiveFileRow = {
  transactionId: string;
  propertyAddress: string;
  serviceType: ServiceType;
  purchasePricePence: number | null;
  expectedFeePence: number | null;
  expectedFeeLabel: string;
  predictedExchangeDate: Date;
  isPastPrediction: boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type AgencyForFee = {
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
  vatRegisteredAt: Date | null;
  vatRateBps: number | null;
};

function feeOverrideOf(a: AgencyForFee): AgencyFeeOverride {
  return { feeTier: a.feeTier, legacyOutsourcedFeePence: a.legacyOutsourcedFeePence };
}

function vatOf(a: AgencyForFee): VatInput {
  return { vatRegisteredAt: a.vatRegisteredAt, vatRateBps: a.vatRateBps };
}

/** Convert the sidebar's scope filter into a Prisma Agency where-clause.
 *  isInternal=false is always added so demo/test agencies never leak in. */
function agencyWhereFromScope(scope: RevenueScope) {
  const where: {
    isInternal: false;
    id?: { in: string[] };
    modeProfile?: AgencyModeProfile;
  } = { isInternal: false };
  if (scope.agencyIds.length > 0) {
    where.id = { in: scope.agencyIds };
  } else if (scope.mode === "sp") {
    where.modeProfile = "self_progressed";
  } else if (scope.mode === "pm") {
    where.modeProfile = "progressor_managed";
  }
  return where;
}

/** Bucket a predicted-exchange date into "this month / next / +1 / at risk".
 *  At-risk wins over the calendar buckets when prediction is already past. */
function bucketForPrediction(
  predicted: Date,
  now: Date,
  monthStart: Date,
  nextMonthStart: Date,
  monthAfterStart: Date,
  monthAfterEnd: Date,
): "past" | "this" | "next" | "after" | "later" {
  if (predicted < now) return "past";
  if (predicted < nextMonthStart) return "this";
  if (predicted < monthAfterStart) return "next";
  if (predicted < monthAfterEnd) return "after";
  return "later";
}

// ─── getRevenueDashboard ──────────────────────────────────────────────────────

export async function getRevenueDashboard(
  scope: RevenueScope,
  now: Date = new Date(),
): Promise<RevenueDashboardData> {
  const { start: monthStart, end: monthEnd } = billingMonthRange(now);
  const nextMonthStart = monthEnd;
  const monthAfterStart = billingMonthRange(new Date(nextMonthStart.getTime() + 32 * 86_400_000)).start;
  const monthAfterEnd = billingMonthRange(new Date(monthAfterStart.getTime() + 32 * 86_400_000)).start;
  const lastMonthStart = billingMonthStart(new Date(monthStart.getTime() - 2 * 86_400_000));

  const agencyWhere = agencyWhereFromScope(scope);

  // Actual invoiced fee lines for a billing month (frozen amounts — the truth
  // of what was billed, unlike a live recompute). Excludes credit lines.
  const feeLineSelect = {
    totalPence: true,
    transactionId: true,
    invoice: { select: { agencyId: true } },
    transaction: { select: { serviceType: true, billedAtExchange: true } },
  } as const;

  // Single fan-out of all reads. Each is independent.
  const [
    agencies,
    bankedRows,
    trialRows,
    activeFiles,
    recentExchangeRows,
    buildingAgg,
    failedRows,
    blockedRows,
    lifetimePerAgency,
    legacyAgencyRows,
    feeLinesThisMonth,
    feeLinesLastMonth,
    referralWonAgg,
    referralCollectedAgg,
  ] = await Promise.all([
    // All agencies in scope — drives the per-agency table.
    commandDb.agency.findMany({
      where: agencyWhere,
      select: {
        id: true,
        name: true,
        modeProfile: true,
        feeTier: true,
        legacyOutsourcedFeePence: true,
        vatRegisteredAt: true,
        vatRateBps: true,
        paymentFailedAt: true,
        newFileCreationBlockedAt: true,
      },
      orderBy: { name: "asc" },
    }),
    // Billed-this-month transactions for "banked" + per-agency banked totals.
    // Excludes trial files (freeOnExchange=true) — those are tracked
    // separately under trialValueThisMonth.
    commandDb.propertyTransaction.findMany({
      where: {
        agency: agencyWhere,
        billedAtExchange: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        propertyAddress: true,
        serviceType: true,
        priceAtExchange: true,
        billedAtExchange: true,
        agencyId: true,
        agency: {
          select: {
            id: true,
            name: true,
            feeTier: true,
            legacyOutsourcedFeePence: true,
            vatRegisteredAt: true,
            vatRateBps: true,
          },
        },
      },
    }),
    // Trial files exchanged this month — value given away.
    commandDb.propertyTransaction.findMany({
      where: {
        agency: agencyWhere,
        freeOnExchange: true,
        exchangedAt: { gte: monthStart, lt: monthEnd },
      },
      select: {
        serviceType: true,
        priceAtExchange: true,
        purchasePrice: true,
        agency: {
          select: {
            feeTier: true,
            legacyOutsourcedFeePence: true,
            vatRegisteredAt: true,
            vatRateBps: true,
          },
        },
      },
    }),
    // Active + on-hold (not yet exchanged) files for pipeline + paused + at-risk.
    // Pulls just enough milestone state for calculatePhaseAwarePrediction.
    commandDb.propertyTransaction.findMany({
      where: {
        agency: agencyWhere,
        status: { in: ["active", "on_hold"] },
        billedAtExchange: null,
        isDemo: false,
      },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        serviceType: true,
        purchasePrice: true,
        purchaseType: true,
        tenure: true,
        isShareOfFreehold: true,
        createdAt: true,
        overridePredictedDate: true,
        agencyId: true,
        agency: {
          select: {
            id: true,
            feeTier: true,
            modeProfile: true,
            legacyOutsourcedFeePence: true,
            vatRegisteredAt: true,
            vatRateBps: true,
          },
        },
        milestoneCompletions: {
          where: { state: { in: ["complete", "not_required"] } },
          select: {
            eventDate: true,
            reconciledAtClaim: true,
            milestoneDefinition: { select: { code: true } },
          },
        },
      },
    }),
    // Last 20 exchanged files across the scope (any month) — forensic strip.
    commandDb.propertyTransaction.findMany({
      where: {
        agency: agencyWhere,
        billedAtExchange: { not: null },
      },
      orderBy: { billedAtExchange: "desc" },
      take: 20,
      select: {
        id: true,
        propertyAddress: true,
        serviceType: true,
        priceAtExchange: true,
        billedAtExchange: true,
        agency: {
          select: {
            id: true,
            name: true,
            feeTier: true,
            legacyOutsourcedFeePence: true,
            vatRegisteredAt: true,
            vatRateBps: true,
          },
        },
      },
    }),
    // Building-invoice aggregate — totalPence already lives on the line rows.
    commandDb.invoiceLine.aggregate({
      where: {
        invoice: { agency: agencyWhere, status: "building" },
      },
      _sum: { totalPence: true },
      _count: { _all: true },
    }),
    commandDb.agency.findMany({
      where: { ...agencyWhere, paymentFailedAt: { not: null } },
      select: { id: true, name: true, paymentFailedAt: true },
      orderBy: { paymentFailedAt: "asc" },
    }),
    commandDb.agency.findMany({
      where: { ...agencyWhere, newFileCreationBlockedAt: { not: null } },
      select: { id: true, name: true, newFileCreationBlockedAt: true },
      orderBy: { newFileCreationBlockedAt: "asc" },
    }),
    // Lifetime billed per agency — single SQL aggregate joined to Invoice
    // and Agency so we can apply scope filters in one round trip.
    commandDb.$queryRaw<Array<{ agencyId: string; totalPence: bigint }>>`
      SELECT i."agencyId" AS "agencyId",
             COALESCE(SUM(il."totalPence"), 0)::bigint AS "totalPence"
        FROM "InvoiceLine" il
        JOIN "Invoice" i ON i.id = il."invoiceId"
        JOIN "Agency" a ON a.id = i."agencyId"
       WHERE i.status IN ('issued', 'paid', 'failed')
         AND a."isInternal" = false
       GROUP BY i."agencyId"
    `,
    // Legacy agency legend — name + locked-in fee, always in scope of the
    // bottom-of-page legend (NOT filtered by the sidebar scope, because the
    // legend is the rulebook; you always want to see all legacy customers).
    commandDb.agency.findMany({
      where: { isInternal: false, feeTier: "legacy", legacyOutsourcedFeePence: { not: null } },
      select: { id: true, name: true, legacyOutsourcedFeePence: true },
      orderBy: { name: "asc" },
    }),
    // Actual invoiced fees this billing month (the truth for "banked").
    commandDb.invoiceLine.findMany({
      where: {
        kind: { in: ["in_house_fee", "outsourced_fee"] },
        invoice: { monthStart, agency: agencyWhere },
      },
      select: feeLineSelect,
    }),
    // Actual invoiced fees the previous billing month (trend baseline).
    commandDb.invoiceLine.findMany({
      where: {
        kind: { in: ["in_house_fee", "outsourced_fee"] },
        invoice: { monthStart: lastMonthStart, agency: agencyWhere },
      },
      select: { totalPence: true },
    }),
    // Provider referral income (won quotes) — separate from our sale fees.
    commandDb.quoteRequest.aggregate({
      where: { status: "won", transaction: { agency: agencyWhere } },
      _sum: { referralFeePence: true },
      _count: { _all: true },
    }),
    commandDb.quoteRequest.aggregate({
      where: { status: "won", referralFeeCollected: true, transaction: { agency: agencyWhere } },
      _sum: { referralFeePence: true },
    }),
  ]);

  const referralEarnedPence = referralWonAgg._sum.referralFeePence ?? 0;
  const referralCollectedPence = referralCollectedAgg._sum.referralFeePence ?? 0;

  // ── Banked = ACTUAL invoiced amounts (frozen InvoiceLine), not a recompute ──
  // so it can never drift if a fee/VAT changes after a file exchanged. Matches
  // the Lifetime column and the building-invoice totals.
  let bankedTotalPence = 0;
  let bankedInHousePence = 0, bankedOutsourcedPence = 0;
  const bankedByAgency = new Map<string, { sum: number; count: number; lastExchange: Date | null }>();
  const accruedTxIds = new Set<string>();
  for (const l of feeLinesThisMonth) {
    bankedTotalPence += l.totalPence;
    if (l.transaction?.serviceType === "self_managed") bankedInHousePence += l.totalPence;
    else bankedOutsourcedPence += l.totalPence;
    if (l.transactionId) accruedTxIds.add(l.transactionId);
    const aId = l.invoice.agencyId;
    const cur = bankedByAgency.get(aId) ?? { sum: 0, count: 0, lastExchange: null };
    cur.sum += l.totalPence;
    cur.count += 1;
    const bx = l.transaction?.billedAtExchange ?? null;
    if (bx && (!cur.lastExchange || bx > cur.lastExchange)) cur.lastExchange = bx;
    bankedByAgency.set(aId, cur);
  }
  // Fallback: a file that exchanged this month but the nightly accrual cron
  // hasn't invoiced yet — recompute so it isn't missing until tomorrow.
  let bankedFallbackCount = 0;
  for (const r of bankedRows) {
    if (accruedTxIds.has(r.id)) continue;
    const fee = computeFee(r.serviceType, r.priceAtExchange, vatOf(r.agency), feeOverrideOf(r.agency));
    bankedTotalPence += fee.totalPence;
    if (r.serviceType === "self_managed") bankedInHousePence += fee.totalPence;
    else bankedOutsourcedPence += fee.totalPence;
    bankedFallbackCount += 1;
    const cur = bankedByAgency.get(r.agencyId) ?? { sum: 0, count: 0, lastExchange: null };
    cur.sum += fee.totalPence;
    cur.count += 1;
    if (r.billedAtExchange && (!cur.lastExchange || r.billedAtExchange > cur.lastExchange)) cur.lastExchange = r.billedAtExchange;
    bankedByAgency.set(r.agencyId, cur);
  }
  const bankedAgencyCount = bankedByAgency.size;
  const bankedFileCount = feeLinesThisMonth.length + bankedFallbackCount;
  const bankedLastMonthPence = feeLinesLastMonth.reduce((s, l) => s + l.totalPence, 0);

  // ── Trial value this month ──────────────────────────────────────────────────
  let trialValuePence = 0;
  for (const r of trialRows) {
    const fee = computeFee(
      r.serviceType,
      r.priceAtExchange ?? r.purchasePrice,
      vatOf(r.agency),
      feeOverrideOf(r.agency),
    );
    trialValuePence += fee.totalPence;
  }

  // ── Pipeline + at-risk (per-file prediction) ────────────────────────────────
  let pipelineThis = 0, pipelineNext = 0, pipelineAfter = 0, pipelineRisk = 0, pipelineLater = 0;
  let pipelineThisCount = 0, pipelineNextCount = 0, pipelineAfterCount = 0, pipelineRiskCount = 0, pipelineLaterCount = 0;
  let pipelineAllSum = 0, pipelineAllCount = 0;
  let pausedSum = 0, pausedCount = 0;
  let priceEstimatedCount = 0;
  let pipeInHouse = 0, pipeOutsourced = 0;
  let pipeTierLegacy = 0, pipeTierStandard = 0;
  let pipeModeSp = 0, pipeModePm = 0, pipeModeMixed = 0;
  const pipelineThisByAgency = new Map<string, { sum: number; count: number }>();
  const activeCountByAgency = new Map<string, number>();

  for (const f of activeFiles) {
    const fee = computeFee(
      f.serviceType as ServiceType,
      f.purchasePrice,
      vatOf(f.agency),
      feeOverrideOf(f.agency),
    );

    // On-hold files are paused: kept in their own bucket, out of the timed
    // pipeline and the active-book headline.
    if (f.status === "on_hold") {
      pausedSum += fee.totalPence;
      pausedCount += 1;
      continue;
    }

    activeCountByAgency.set(f.agencyId, (activeCountByAgency.get(f.agencyId) ?? 0) + 1);

    // Silent-estimate flag: a standard (non-legacy) outsourced file with no
    // price falls to the bottom band by computeFee's defensive default.
    if (f.serviceType === "outsourced" && f.agency.feeTier !== "legacy" && f.purchasePrice == null) {
      priceEstimatedCount += 1;
    }

    // Where the money comes from (active book).
    if (f.serviceType === "self_managed") pipeInHouse += fee.totalPence; else pipeOutsourced += fee.totalPence;
    if (f.agency.feeTier === "legacy") pipeTierLegacy += fee.totalPence; else pipeTierStandard += fee.totalPence;
    if (f.agency.modeProfile === "self_progressed") pipeModeSp += fee.totalPence;
    else if (f.agency.modeProfile === "progressor_managed") pipeModePm += fee.totalPence;
    else pipeModeMixed += fee.totalPence;

    const completedCodes = f.milestoneCompletions.map((c) => c.milestoneDefinition.code);
    const effectiveStart = computeEffectiveStartDate(f.createdAt, f.milestoneCompletions);
    const phaseInput: PhaseAwareInput = {
      completedMilestoneCodes: completedCodes,
      purchaseType: f.purchaseType,
      tenure: f.tenure,
      isShareOfFreehold: f.isShareOfFreehold,
      effectiveStartDate: effectiveStart,
    };
    const predicted = calculatePhaseAwarePrediction(phaseInput, f.createdAt, f.overridePredictedDate);

    // Headline total: every active file counts (this/next/after/later/at-risk).
    pipelineAllSum += fee.totalPence;
    pipelineAllCount += 1;

    const bucket = bucketForPrediction(predicted, now, monthStart, nextMonthStart, monthAfterStart, monthAfterEnd);
    if (bucket === "past") {
      pipelineRisk += fee.totalPence;
      pipelineRiskCount += 1;
    } else if (bucket === "this") {
      pipelineThis += fee.totalPence;
      pipelineThisCount += 1;
      const cur = pipelineThisByAgency.get(f.agencyId) ?? { sum: 0, count: 0 };
      cur.sum += fee.totalPence;
      cur.count += 1;
      pipelineThisByAgency.set(f.agencyId, cur);
    } else if (bucket === "next") {
      pipelineNext += fee.totalPence;
      pipelineNextCount += 1;
    } else if (bucket === "after") {
      pipelineAfter += fee.totalPence;
      pipelineAfterCount += 1;
    } else {
      // "later" — predicted beyond the +2-month window.
      pipelineLater += fee.totalPence;
      pipelineLaterCount += 1;
    }
  }

  // ── Recent exchanges (forensic strip) — show the ACTUAL invoiced amount. ─────
  const recentLines = recentExchangeRows.length
    ? await commandDb.invoiceLine.findMany({
        where: {
          transactionId: { in: recentExchangeRows.map((r) => r.id) },
          kind: { in: ["in_house_fee", "outsourced_fee"] },
        },
        select: { transactionId: true, totalPence: true },
      })
    : [];
  const billedByTx = new Map<string, number>();
  for (const l of recentLines) if (l.transactionId) billedByTx.set(l.transactionId, l.totalPence);

  const recentExchanges: ExchangeRow[] = recentExchangeRows.map((r) => {
    const fee = computeFee(r.serviceType, r.priceAtExchange, vatOf(r.agency), feeOverrideOf(r.agency));
    return {
      transactionId: r.id,
      propertyAddress: r.propertyAddress,
      agencyId: r.agency.id,
      agencyName: r.agency.name,
      agencyFeeTier: r.agency.feeTier,
      serviceType: r.serviceType,
      priceAtExchangePence: r.priceAtExchange,
      // Actual billed amount when invoiced; recompute only as a same-day fallback.
      feeTotalPence: billedByTx.get(r.id) ?? fee.totalPence,
      feeBandLabel: fee.bandLabel,
      exchangedAt: r.billedAtExchange!,
    };
  });

  // ── Per-agency table assembly ───────────────────────────────────────────────
  const lifetimeMap = new Map<string, number>();
  for (const r of lifetimePerAgency) {
    lifetimeMap.set(r.agencyId, Number(r.totalPence));
  }

  const perAgency: AgencyRevenueRow[] = agencies.map((a) => {
    const banked = bankedByAgency.get(a.id) ?? { sum: 0, count: 0, lastExchange: null };
    const pipeline = pipelineThisByAgency.get(a.id) ?? { sum: 0, count: 0 };
    return {
      agencyId: a.id,
      name: a.name,
      modeProfile: a.modeProfile,
      feeTier: a.feeTier,
      legacyOutsourcedFeePence: a.legacyOutsourcedFeePence,
      vatRegisteredAt: a.vatRegisteredAt,
      activeFileCount: activeCountByAgency.get(a.id) ?? 0,
      bankedThisMonthPence: banked.sum,
      bankedThisMonthCount: banked.count,
      pipelineThisMonthPence: pipeline.sum,
      pipelineThisMonthCount: pipeline.count,
      lifetimeBilledPence: lifetimeMap.get(a.id) ?? 0,
      lastExchangeAt: banked.lastExchange,
      paymentFailedAt: a.paymentFailedAt,
      newFileCreationBlockedAt: a.newFileCreationBlockedAt,
    };
  });
  // Lifetime contribution desc, then banked-this-month desc as a tie-break.
  perAgency.sort((a, b) => {
    if (b.lifetimeBilledPence !== a.lifetimeBilledPence) {
      return b.lifetimeBilledPence - a.lifetimeBilledPence;
    }
    return b.bankedThisMonthPence - a.bankedThisMonthPence;
  });

  return {
    asOf: now,
    monthStart,
    monthEnd,
    scope,
    banked: {
      totalPence: bankedTotalPence,
      fileCount: bankedFileCount,
      agencyCount: bankedAgencyCount,
    },
    bankedLastMonthPence,
    pipelineAllActive: { totalPence: pipelineAllSum, fileCount: pipelineAllCount },
    pipelineThisMonth: { totalPence: pipelineThis, fileCount: pipelineThisCount },
    forecastTotalThisMonth: { totalPence: bankedTotalPence + pipelineThis },
    trialValueThisMonth: { totalPence: trialValuePence, fileCount: trialRows.length },
    pipelineNextMonth: { totalPence: pipelineNext, fileCount: pipelineNextCount },
    pipelineMonthAfter: { totalPence: pipelineAfter, fileCount: pipelineAfterCount },
    pipelineAtRisk: { totalPence: pipelineRisk, fileCount: pipelineRiskCount },
    pipelineLater: { totalPence: pipelineLater, fileCount: pipelineLaterCount },
    paused: { totalPence: pausedSum, fileCount: pausedCount },
    threeMonthForecastPence: pipelineThis + pipelineNext + pipelineAfter,
    priceEstimatedCount,
    breakdown: {
      bankedByServiceType: { inHousePence: bankedInHousePence, outsourcedPence: bankedOutsourcedPence },
      pipelineByServiceType: { inHousePence: pipeInHouse, outsourcedPence: pipeOutsourced },
      pipelineByTier: { legacyPence: pipeTierLegacy, standardPence: pipeTierStandard },
      pipelineByMode: { spPence: pipeModeSp, pmPence: pipeModePm, mixedPence: pipeModeMixed },
    },
    perAgency,
    recentExchanges,
    buildingInvoices: {
      invoiceCount: buildingAgg._count._all,
      totalPence: buildingAgg._sum.totalPence ?? 0,
    },
    failedPayments: failedRows.map((a) => ({
      agencyId: a.id,
      name: a.name,
      flaggedAt: a.paymentFailedAt!,
    })),
    blockedAgencies: blockedRows.map((a) => ({
      agencyId: a.id,
      name: a.name,
      flaggedAt: a.newFileCreationBlockedAt!,
    })),
    legacyAgencies: legacyAgencyRows.map((a) => ({
      agencyId: a.id,
      name: a.name,
      legacyOutsourcedFeePence: a.legacyOutsourcedFeePence!,
    })),
    referralIncome: {
      earnedPence: referralEarnedPence,
      collectedPence: referralCollectedPence,
      outstandingPence: referralEarnedPence - referralCollectedPence,
      wonCount: referralWonAgg._count._all,
    },
  };
}

// ─── getAgencyRevenueDetail ───────────────────────────────────────────────────

export async function getAgencyRevenueDetail(
  agencyId: string,
  now: Date = new Date(),
): Promise<AgencyRevenueDetailData | null> {
  const { start: monthStart, end: monthEnd } = billingMonthRange(now);
  const nextMonthStart = monthEnd;
  const monthAfterStart = billingMonthRange(new Date(nextMonthStart.getTime() + 32 * 86_400_000)).start;
  const monthAfterEnd = billingMonthRange(new Date(monthAfterStart.getTime() + 32 * 86_400_000)).start;

  const agency = await commandDb.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      isInternal: true,
      modeProfile: true,
      feeTier: true,
      legacyOutsourcedFeePence: true,
      vatRegisteredAt: true,
      vatRateBps: true,
      paymentFailedAt: true,
      newFileCreationBlockedAt: true,
      firstSubmissionAt: true,
      stripeCustomerId: true,
      createdAt: true,
    },
  });
  if (!agency || agency.isInternal) return null;

  const [bankedRows, activeFiles, recentExchangeRows, trialRows, lifetimeRow, feeLinesThisMonth] = await Promise.all([
    commandDb.propertyTransaction.findMany({
      where: { agencyId, billedAtExchange: { gte: monthStart, lt: monthEnd } },
      select: {
        id: true,
        propertyAddress: true,
        serviceType: true,
        priceAtExchange: true,
        billedAtExchange: true,
      },
    }),
    commandDb.propertyTransaction.findMany({
      where: { agencyId, status: "active", billedAtExchange: null, isDemo: false },
      select: {
        id: true,
        propertyAddress: true,
        serviceType: true,
        purchasePrice: true,
        purchaseType: true,
        tenure: true,
        isShareOfFreehold: true,
        createdAt: true,
        overridePredictedDate: true,
        milestoneCompletions: {
          where: { state: { in: ["complete", "not_required"] } },
          select: {
            eventDate: true,
            reconciledAtClaim: true,
            milestoneDefinition: { select: { code: true } },
          },
        },
      },
    }),
    commandDb.propertyTransaction.findMany({
      where: { agencyId, billedAtExchange: { not: null } },
      orderBy: { billedAtExchange: "desc" },
      take: 20,
      select: {
        id: true,
        propertyAddress: true,
        serviceType: true,
        priceAtExchange: true,
        billedAtExchange: true,
      },
    }),
    commandDb.propertyTransaction.findMany({
      where: { agencyId, freeOnExchange: true, exchangedAt: { not: null } },
      select: { serviceType: true, priceAtExchange: true, purchasePrice: true },
    }),
    commandDb.$queryRaw<Array<{ totalPence: bigint }>>`
      SELECT COALESCE(SUM(il."totalPence"), 0)::bigint AS "totalPence"
        FROM "InvoiceLine" il
        JOIN "Invoice" i ON i.id = il."invoiceId"
       WHERE i."agencyId" = ${agencyId}
         AND i.status IN ('issued', 'paid', 'failed')
    `,
    // Actual invoiced fees this month for this agency (banked truth).
    commandDb.invoiceLine.findMany({
      where: {
        kind: { in: ["in_house_fee", "outsourced_fee"] },
        invoice: { agencyId, monthStart },
      },
      select: { totalPence: true, transactionId: true },
    }),
  ]);

  const agencyForFee: AgencyForFee = {
    feeTier: agency.feeTier,
    legacyOutsourcedFeePence: agency.legacyOutsourcedFeePence,
    vatRegisteredAt: agency.vatRegisteredAt,
    vatRateBps: agency.vatRateBps,
  };
  const fee = (svc: ServiceType, price: number | null) =>
    computeFee(svc, price, vatOf(agencyForFee), feeOverrideOf(agencyForFee));

  // Banked = actual invoiced (frozen InvoiceLine) + a recompute fallback for a
  // same-day exchange the nightly accrual hasn't invoiced yet.
  let bankedSum = 0;
  let bankedCount = 0;
  const accruedTxIds = new Set<string>();
  for (const l of feeLinesThisMonth) {
    bankedSum += l.totalPence;
    bankedCount += 1;
    if (l.transactionId) accruedTxIds.add(l.transactionId);
  }
  for (const r of bankedRows) {
    if (accruedTxIds.has(r.id)) continue;
    bankedSum += fee(r.serviceType, r.priceAtExchange).totalPence;
    bankedCount += 1;
  }

  // Trial lifetime
  let trialLifetime = 0;
  for (const r of trialRows) {
    trialLifetime += fee(r.serviceType, r.priceAtExchange ?? r.purchasePrice).totalPence;
  }

  // Pipeline + at-risk + active files list
  let pipeThis = 0, pipeNext = 0, pipeAfter = 0, pipeRisk = 0;
  let pipeThisC = 0, pipeNextC = 0, pipeAfterC = 0, pipeRiskC = 0;
  let pipeAllSum = 0, pipeAllCount = 0;
  const activeFileRows: ActiveFileRow[] = [];
  for (const f of activeFiles) {
    const completedCodes = f.milestoneCompletions.map((c) => c.milestoneDefinition.code);
    const effectiveStart = computeEffectiveStartDate(f.createdAt, f.milestoneCompletions);
    const phaseInput: PhaseAwareInput = {
      completedMilestoneCodes: completedCodes,
      purchaseType: f.purchaseType as PurchaseType | null,
      tenure: f.tenure as Tenure | null,
      isShareOfFreehold: f.isShareOfFreehold,
      effectiveStartDate: effectiveStart,
    };
    const predicted = calculatePhaseAwarePrediction(phaseInput, f.createdAt, f.overridePredictedDate);
    const expected = fee(f.serviceType, f.purchasePrice);
    pipeAllSum += expected.totalPence;
    pipeAllCount += 1;
    const bucket = bucketForPrediction(predicted, now, monthStart, nextMonthStart, monthAfterStart, monthAfterEnd);
    if (bucket === "past") { pipeRisk += expected.totalPence; pipeRiskC += 1; }
    else if (bucket === "this") { pipeThis += expected.totalPence; pipeThisC += 1; }
    else if (bucket === "next") { pipeNext += expected.totalPence; pipeNextC += 1; }
    else if (bucket === "after") { pipeAfter += expected.totalPence; pipeAfterC += 1; }
    activeFileRows.push({
      transactionId: f.id,
      propertyAddress: f.propertyAddress,
      serviceType: f.serviceType,
      purchasePricePence: f.purchasePrice,
      expectedFeePence: expected.totalPence,
      expectedFeeLabel: expected.bandLabel,
      predictedExchangeDate: predicted,
      isPastPrediction: predicted < now,
    });
  }
  activeFileRows.sort((a, b) => a.predictedExchangeDate.getTime() - b.predictedExchangeDate.getTime());

  const recentLines = recentExchangeRows.length
    ? await commandDb.invoiceLine.findMany({
        where: {
          transactionId: { in: recentExchangeRows.map((r) => r.id) },
          kind: { in: ["in_house_fee", "outsourced_fee"] },
        },
        select: { transactionId: true, totalPence: true },
      })
    : [];
  const billedByTx = new Map<string, number>();
  for (const l of recentLines) if (l.transactionId) billedByTx.set(l.transactionId, l.totalPence);

  const recentExchanges: ExchangeRow[] = recentExchangeRows.map((r) => {
    const f = fee(r.serviceType, r.priceAtExchange);
    return {
      transactionId: r.id,
      propertyAddress: r.propertyAddress,
      agencyId: agency.id,
      agencyName: agency.name,
      agencyFeeTier: agency.feeTier,
      serviceType: r.serviceType,
      priceAtExchangePence: r.priceAtExchange,
      feeTotalPence: billedByTx.get(r.id) ?? f.totalPence,
      feeBandLabel: f.bandLabel,
      exchangedAt: r.billedAtExchange!,
    };
  });

  return {
    asOf: now,
    monthStart,
    monthEnd,
    agency: {
      id: agency.id,
      name: agency.name,
      modeProfile: agency.modeProfile,
      feeTier: agency.feeTier,
      legacyOutsourcedFeePence: agency.legacyOutsourcedFeePence,
      vatRegisteredAt: agency.vatRegisteredAt,
      vatRateBps: agency.vatRateBps,
      paymentFailedAt: agency.paymentFailedAt,
      newFileCreationBlockedAt: agency.newFileCreationBlockedAt,
      firstSubmissionAt: agency.firstSubmissionAt,
      stripeCustomerId: agency.stripeCustomerId,
      createdAt: agency.createdAt,
    },
    banked: { totalPence: bankedSum, fileCount: bankedCount },
    pipelineAllActive: { totalPence: pipeAllSum, fileCount: pipeAllCount },
    pipelineThisMonth: { totalPence: pipeThis, fileCount: pipeThisC },
    pipelineNextMonth: { totalPence: pipeNext, fileCount: pipeNextC },
    pipelineMonthAfter: { totalPence: pipeAfter, fileCount: pipeAfterC },
    pipelineAtRisk: { totalPence: pipeRisk, fileCount: pipeRiskC },
    lifetimeBilledPence: Number(lifetimeRow[0]?.totalPence ?? 0),
    trialValueLifetimePence: trialLifetime,
    trialExchangeCountLifetime: trialRows.length,
    recentExchanges,
    activeFiles: activeFileRows,
  };
}

// ─── Formatting helpers (UI-shared) ───────────────────────────────────────────

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function formatGBPLong(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatShortDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

export function formatMonthLabel(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
