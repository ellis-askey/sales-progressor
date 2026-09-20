// lib/services/fees.ts
// Fee calculation and progress/exchange prediction logic.

import type { ClientType, Tenure, PurchaseType, FeeVatTreatment } from "@prisma/client";
import { computeFee } from "@/lib/billing/fee";
import { pooledCompletionRaw } from "@/lib/milestones/progress-percent";

// ─── VAT helpers ───────────────────────────────────────────────────────────────
// Income is stated ex VAT: VAT is collected for HMRC, never the agency's income.
// `plus` = the stored figure is already ex VAT; `inc` = it includes VAT, so
// divide it out. A null/absent treatment is `plus` (the backfill default). One
// home for this so the fees card and every report agree.
const VAT_MULTIPLIER = 1.2;

export function feeExVat(pence: number | null | undefined, vat: FeeVatTreatment | null | undefined): number {
  if (!pence) return 0;
  return vat === "inc" ? Math.round(pence / VAT_MULTIPLIER) : pence;
}

// The VAT portion of a fee (money collected for HMRC). `plus` adds VAT on top;
// `inc` carries it within; used by the fees card's "VAT to collect" footnote.
export function feeVatPortion(pence: number | null | undefined, vat: FeeVatTreatment | null | undefined): number {
  if (!pence) return 0;
  if (vat === "inc") return pence - Math.round(pence / VAT_MULTIPLIER);
  return Math.round(pence * VAT_MULTIPLIER) - pence;
}


// ─── Fee calculation ──────────────────────────────────────────────────────────

/**
 * Calculate our fee for an outsourced transaction.
 *
 * Priority order:
 *   1. Per-agency legacy override — set via /command/agencies, sticks to the customer
 *      regardless of which SP handles the file. Highest precedence.
 *   2. Per-SP legacy fee — existing User-level model, retained for back-compat.
 *   3. Standard sliding scale based on purchase price — delegated to
 *      lib/billing/fee.ts:computeFee so the UI and the issued invoice always
 *      agree. (Previously the ladder was duplicated here, which is exactly
 *      the bug class that bit the per-agency override in the billing system.)
 *
 * Self-managed (£59) is hardcoded in the call site (TransactionSidebar) and
 * never calls this function — the agency override does NOT apply there.
 */
export function calculateOurFee(
  clientType: ClientType,
  legacyFee: number | null,
  purchasePrice: number | null, // in pence
  agencyOverride?: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null,
): { fee: number | null; label: string } {
  // Display rule (2026-06): the resolved label is always the actual £
  // figure formatted via formatFee — no descriptive classification
  // ("Standard (£500k+)", "Legacy fixed fee (agency)", etc.) reaches the
  // UI. Error-state labels stay descriptive because the caller hides the
  // row entirely when fee is null (ourFee.fee != null gate in
  // TransactionSidebar).

  // 1. Per-agency legacy override wins if configured.
  if (agencyOverride?.feeTier === "legacy") {
    if (agencyOverride.legacyOutsourcedFeePence == null) {
      return { fee: null, label: "Agency legacy — fee not set" };
    }
    return {
      fee: agencyOverride.legacyOutsourcedFeePence,
      label: formatFee(agencyOverride.legacyOutsourcedFeePence),
    };
  }

  // 2. Per-SP legacy fee — pre-existing behaviour, unchanged.
  if (clientType === "legacy") {
    if (!legacyFee) return { fee: null, label: "Legacy — fee not set" };
    return { fee: legacyFee, label: formatFee(legacyFee) };
  }

  // 3. Standard sliding scale — delegated to computeFee. Null-guard before
  // delegation so we keep the "price not set" UI label; computeFee would
  // fall back to the bottom band on null, which is wrong for display.
  if (!purchasePrice) return { fee: null, label: "Standard — price not set" };
  const { totalPence } = computeFee("outsourced", purchasePrice, null, null);
  return { fee: totalPence, label: formatFee(totalPence) };
}

// ─── Per-file net fees (what this file is worth to the agency) ───────────────
// The property-file Fees card's headline sum, extracted (2026-09-18) so the
// hub's exchange forecast can total the same number per week. Mirrors
// AgentFileSidebar exactly: agent commission (fixed amount, or percent of the
// sale price, as entered) + solicitor referral + buyer's broker referral +
// seller's onward-broker referral, minus our progression fee — which is zero
// for self-managed files, files marked free-on-exchange / first-outsourced-
// free, and free-plan agencies.

export type FileFeesInput = {
  purchasePrice: number | null;      // pence
  agentFeeAmount: number | null;     // pence
  agentFeePercent: unknown;          // Prisma Decimal | number | null
  // Agent fee is always "+ VAT" at the end of the day; a null flag is treated as
  // exclusive. Backed out so net income is stated ex VAT (matches the fees card).
  agentFeeIsVatInclusive?: boolean | null;
  referralFee: number | null;
  referralFeeVat?: FeeVatTreatment | null;
  brokerReferralFee: number | null;
  brokerReferralFeeVat?: FeeVatTreatment | null;
  onwardBrokerReferralFee: number | null;
  onwardBrokerReferralFeeVat?: FeeVatTreatment | null;
  serviceType: "self_managed" | "outsourced";
  freeOnExchange: boolean;
  firstOutsourcedFree: boolean;
  assignedUser: { clientType: ClientType; legacyFee: number | null } | null;
  agencyOverride: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null;
};

// Our (Sales Progressor's) progression fee for a file — the revenue WE earn from
// it, in pence. Zero for self-managed (self-progression is free), files marked
// free-on-exchange / first-outsourced-free, and free-tier agencies. This is the
// exact figure calculateFileFeesPence subtracts from the agency's net, extracted
// (2026-09-18) so the hub can total our own pipeline revenue without re-deriving
// the logic (and risking drift).
export function calculateProgressionFeePence(t: FileFeesInput): number {
  const ourFee = t.serviceType === "self_managed"
    ? 0
    : t.assignedUser
      ? calculateOurFee(t.assignedUser.clientType, t.assignedUser.legacyFee, t.purchasePrice, t.agencyOverride).fee ?? 0
      : t.agencyOverride?.feeTier === "legacy" && t.agencyOverride.legacyOutsourcedFeePence != null
        ? t.agencyOverride.legacyOutsourcedFeePence
        : 0;

  const agencyIsFree = t.agencyOverride?.feeTier === "free";
  return !t.freeOnExchange && !t.firstOutsourcedFree && !agencyIsFree ? ourFee : 0;
}

export function calculateFileFeesPence(t: FileFeesInput): number {
  const agentFeeCalcPence: number | null =
    t.agentFeeAmount != null
      ? t.agentFeeAmount
      : t.agentFeePercent != null && t.purchasePrice != null
        ? Math.round(t.purchasePrice * Number(t.agentFeePercent) / 100)
        : null;

  const progressorFeePence = calculateProgressionFeePence(t);

  // Net income, stated ex VAT: the agent fee and every referral are backed out of
  // VAT so this matches the fees card exactly, then the progressor fee comes off.
  const agentFeeExVat = t.agentFeeIsVatInclusive === true && agentFeeCalcPence != null
    ? Math.round(agentFeeCalcPence / VAT_MULTIPLIER)
    : (agentFeeCalcPence ?? 0);

  return (
    agentFeeExVat
    + feeExVat(t.referralFee, t.referralFeeVat)
    + feeExVat(t.brokerReferralFee, t.brokerReferralFeeVat)
    + feeExVat(t.onwardBrokerReferralFee, t.onwardBrokerReferralFeeVat)
    - progressorFeePence
  );
}

/**
 * Format pence as pounds sterling string.
 */
export function formatFee(pence: number | null): string {
  if (pence === null) return "—";
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}

export function formatPrice(pence: number | null): string {
  if (pence === null) return "—";
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}

// ─── Progress calculation ──────────────────────────────────────────────────────
// Weight-based, per-side formula per MILESTONES_WEIGHTS_v1.md.
// Denominator = sum of weights of applicable (non-NR) milestones on each side.
// Overall = 50/50 blend of vendor and purchaser raw percentages.

export type MilestoneLite = {
  weight: number;      // Number(def.weight) — Decimal safe via Number()
  isComplete: boolean;
  isNotRequired: boolean;
};

export type ProgressResult = {
  percent: number;          // overall blended, rounded to integer for display
  vendorPercent: number;    // vendor-side, rounded
  purchaserPercent: number; // purchaser-side, rounded
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  twelveWeekTarget: Date | null;
  predictedExchangeDate: Date | null;
  isEarlyEstimate: boolean; // true when still in Phase A (onboarding) and prediction is the 12-week target
  weeksElapsed: number;
  daysElapsed: number;
  weeksRemaining: number | null;
  fileLevelPhase?: FileLevelPhase | null;
};

// ─── Phase-aware exchange forecast (Arc 2) ────────────────────────────────────
// Critical-path model per docs/forecasting/phase-aware-model-proposal.md.
// Conservative median durations — do not tighten until Level-3 data (50+ completed files).
// Confirmed values (Ellis, May 2026): PM11 ~10d, PM13 ~21d, PM9 7–21d (median 14d).
// All other values are range midpoints from the proposal doc.

// Enquiries rework: the enquiries stage is now two steps a side (received/raised
// -> satisfied). The "satisfied" median (VM21 / PM20 = 28 days) is the whole
// enquiries resolution time and already averages however many rounds a file
// runs. The retired sub-steps (VM11-15 / PM15-19) are removed — they never
// complete, so leaving them here permanently inflated the forecast.
export const MILESTONE_DURATION_MEDIANS: Record<string, number> = {
  // Vendor side
  VM1: 1,  VM2: 1,  VM3: 3,  VM4: 8,  VM5: 2,  VM6: 17, VM7: 6,
  VM8: 1,  /* VM9: see isShareOfFreehold logic below */
  VM10: 14, VM21: 28,
  VM16: 13, VM17: 8,  VM18: 2,  VM19: 0,  VM20: 17,
  // Purchaser side
  PM1: 1,  PM2: 1,  PM3: 8,  PM4: 6,  PM5: 3,  PM6: 9,  PM7: 13,
  PM8: 2,  PM9: 14, PM10: 14, PM11: 10, /* PM12: same as VM9 */
  PM13: 21, PM14: 14, PM20: 28,
  PM21: 6,  PM22: 3,  PM23: 8,  PM24: 3,  PM25: 2,  PM26: 0, PM27: 17,
};

export type PhaseAwareInput = {
  completedMilestoneCodes: string[];
  purchaseType: PurchaseType | null;
  tenure: Tenure | null;
  isShareOfFreehold: boolean;
  // For claim-reconciled files: earliest non-null eventDate among reconciledAtClaim
  // completions. Used as the 12-week-target floor anchor so prediction floors based
  // on when the sale actually started, not when the agent claimed.
  // If unset, falls back to createdAt.
  effectiveStartDate?: Date;
};

export type FileLevelPhase = "onboarding" | "conveyancing" | "pre_exchange" | "post_exchange";
export type SideLevelPhase = "onboarding" | "conveyancing" | "pre_exchange" | "post_exchange";

export type DetectedPhase = {
  fileLevelPhase: FileLevelPhase;
  vendorPhase: SideLevelPhase;
  purchaserPhase: SideLevelPhase;
};

export function detectPhase(completedCodes: Set<string>): DetectedPhase {
  const vendorPhase: SideLevelPhase =
    completedCodes.has("VM19") ? "post_exchange" :
    completedCodes.has("VM17") ? "pre_exchange" :
    completedCodes.has("VM4")  ? "conveyancing" :
    "onboarding";

  const purchaserPhase: SideLevelPhase =
    completedCodes.has("PM26") ? "post_exchange" :
    completedCodes.has("PM20") ? "pre_exchange" :
    completedCodes.has("PM4")  ? "conveyancing" :
    "onboarding";

  const fileLevelPhase: FileLevelPhase =
    (completedCodes.has("VM19") || completedCodes.has("PM26")) ? "post_exchange" :
    completedCodes.has("PM20")                                  ? "pre_exchange" :
    (completedCodes.has("VM4") && completedCodes.has("PM4"))   ? "conveyancing" :
    "onboarding";

  return { fileLevelPhase, vendorPhase, purchaserPhase };
}

function vendorRemainingDays(
  done: Set<string>,
  tenure: Tenure | null,
  isShareOfFreehold: boolean,
  enquiryRounds: number,
): number {
  const d = (id: string): number => done.has(id) ? 0 : (MILESTONE_DURATION_MEDIANS[id] ?? 0);
  const vm9Median = isShareOfFreehold ? 14 : 35;

  // Sequential chain: VM1 → VM3 → VM4 → VM5 → VM6 → VM7
  const toVM7 = d("VM1") + d("VM3") + d("VM4") + d("VM5") + d("VM6") + d("VM7");

  // Enquiries track (parallel from VM7): received (VM10) → satisfied (VM21).
  // The satisfied median already averages however many rounds a file runs, so
  // there's no per-round expansion. (enquiryRounds retained for signature parity.)
  void enquiryRounds;
  const enquiriesTrack = d("VM10") + d("VM21");

  // Contract track (parallel from VM7): VM16 → VM17
  const contractTrack = d("VM16") + d("VM17");

  // Leasehold track (parallel from file creation): VM8 → VM9
  const leaseholdTrack = tenure === "leasehold"
    ? d("VM8") + (done.has("VM9") ? 0 : vm9Median)
    : 0;

  return toVM7 + Math.max(enquiriesTrack, contractTrack, leaseholdTrack) + d("VM18");
}

function purchaserRemainingDays(
  done: Set<string>,
  purchaseType: PurchaseType | null,
  tenure: Tenure | null,
  isShareOfFreehold: boolean,
  enquiryRounds: number,
): number {
  const d = (id: string): number => done.has(id) ? 0 : (MILESTONE_DURATION_MEDIANS[id] ?? 0);
  const isCash = purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds";

  // Sequential chain: PM1 → PM4 → PM7
  const toPM7 = d("PM1") + d("PM4") + d("PM7");

  // Mortgage track (parallel from PM5/PM7): PM6 → PM11
  const mortgageTrack = isCash ? 0 : d("PM6") + d("PM11");

  // Search track (parallel from PM8): PM8 → PM13
  const searchTrack = d("PM8") + d("PM13");

  // Enquiries track: raised (PM14) → satisfied (PM20). The satisfied median
  // already averages however many rounds run. (enquiryRounds retained for parity.)
  void enquiryRounds;
  let enquiriesTrack = d("PM14") + d("PM20");
  if (isCash) enquiriesTrack = Math.round(enquiriesTrack * 0.75);

  const parallelEnd = Math.max(mortgageTrack, searchTrack, enquiriesTrack);

  // Sequential pre-exchange chain. PM20 now lives in the enquiries track (it IS
  // "satisfied"), so pre-exchange starts at the final report.
  const preExchange = d("PM21") + d("PM22") + d("PM23") + d("PM24") + d("PM25");

  return toPM7 + parallelEnd + preExchange;
}

// Computes the effective sale-start date for prediction anchoring.
//
// For files where the agent reconciled milestones at claim with at least one
// known eventDate, returns the earliest such eventDate (when the sale actually
// began in the real world). For files with no claim-reconciliation, returns
// createdAt. Used to anchor the 12-week target and elapsed-time calculations
// in calculateProgress / calculatePhaseAwarePrediction.
//
// reconciledAtClaim completions with null eventDate are ignored — the agent
// ticked them but didn't supply a date, so they can't contribute to the anchor.
export function computeEffectiveStartDate(
  createdAt: Date,
  completions: { eventDate: Date | null; reconciledAtClaim: boolean }[],
): Date {
  const eventDates = completions
    .filter((c) => c.reconciledAtClaim && c.eventDate)
    .map((c) => c.eventDate as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const earliest = eventDates[0];
  if (!earliest) return createdAt;
  return earliest < createdAt ? earliest : createdAt;
}

// England & Wales bank holidays. Exchange/completion cannot happen on these, so
// a predicted or target date must roll off them just like a weekend.
//
// Static list (the source, https://www.gov.uk/bank-holidays.json, needs a live
// network call we don't want inside a synchronous date helper). Predictions are
// only ever weeks-to-months out, so a few years ahead is plenty. EXTEND THIS
// before the last year listed runs out — otherwise late-in-range dates silently
// stop being holiday-aware (they still roll off weekends). England & Wales only;
// Scotland / NI differ, and conveyancing here is E&W-dominant.
const UK_BANK_HOLIDAYS_ENG_WALES = new Set<string>([
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
  "2026-08-31", "2026-12-25", "2026-12-28",
  // 2027
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31",
  "2027-08-30", "2027-12-27", "2027-12-28",
  // 2028
  "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29",
  "2028-08-28", "2028-12-25", "2028-12-26",
]);

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBusinessDay(d: Date): boolean {
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday (local)
  if (day === 0 || day === 6) return false;
  return !UK_BANK_HOLIDAYS_ENG_WALES.has(toLocalIsoDate(d));
}

// Exchange (and the 12-week target) never falls on a weekend or an England &
// Wales bank holiday — completion/exchange are working-day events. Roll forward
// day by day until we land on a working day (e.g. a Saturday that's followed by
// a bank-holiday Monday rolls all the way to the Tuesday). Bounded loop covers
// the longest holiday cluster (Christmas/New Year) with room to spare.
export function rollToBusinessDay(d: Date): Date {
  const x = new Date(d);
  for (let i = 0; i < 14 && !isBusinessDay(x); i++) {
    x.setDate(x.getDate() + 1);
  }
  return x;
}

export function calculatePhaseAwarePrediction(
  input: PhaseAwareInput,
  createdAt: Date,
  overrideDate?: Date | null,
): Date {
  if (overrideDate) return rollToBusinessDay(overrideDate);

  const now = new Date();
  // 12-week target floor anchors on the real sale start, not the claim date.
  // For claim-reconciled files, effectiveStartDate is the earliest eventDate provided
  // by the agent (the real-world moment the sale began). For non-claimed files, falls
  // back to createdAt. This stops claimed files predicting weeks too late.
  const anchorDate = input.effectiveStartDate ?? createdAt;
  const twelveWeekTarget = new Date(anchorDate);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const done = new Set(input.completedMilestoneCodes);
  const enquiryRounds = input.tenure === "leasehold" ? 3 : 2;

  const vendorDays = vendorRemainingDays(done, input.tenure, input.isShareOfFreehold, enquiryRounds);
  const purchaserDays = purchaserRemainingDays(done, input.purchaseType, input.tenure, input.isShareOfFreehold, enquiryRounds);

  const predicted = new Date(now);
  predicted.setDate(predicted.getDate() + Math.max(vendorDays, purchaserDays));

  // Floor: never predict earlier than the 12-week target. Roll off any weekend.
  return rollToBusinessDay(predicted > twelveWeekTarget ? predicted : twelveWeekTarget);
}

function calcSideRaw(milestones: MilestoneLite[]): number {
  const applicable = milestones.filter((m) => !m.isNotRequired);
  const applicableWeight = applicable.reduce((s, m) => s + m.weight, 0);
  if (applicableWeight === 0) return 100; // all NR → side complete
  const completedWeight = applicable.filter((m) => m.isComplete).reduce((s, m) => s + m.weight, 0);
  return (completedWeight / applicableWeight) * 100;
}

export function calculateProgress(
  vendor: MilestoneLite[],
  purchaser: MilestoneLite[],
  createdAt: Date,
  overridePredictedDate?: Date | null,
  phaseAware?: PhaseAwareInput,
  // Optional: when provided, on-hold periods are subtracted from elapsed time
  // so weeks-elapsed, on-track signal and velocity-based predicted exchange
  // freeze while the file is paused. Status="on_hold" forces onTrack="on_hold".
  hold?: { status: import("@prisma/client").TransactionStatus; holdMs: number },
): ProgressResult {
  const now = new Date();

  const vendorRaw     = calcSideRaw(vendor);
  const purchaserRaw  = calcSideRaw(purchaser);

  // Pooled weighted progress: single ratio across all applicable milestones.
  // Shared with the live file-page hero via pooledCompletionRaw so the browser
  // recomputes the identical number on an optimistic tick (no second copy).
  const overallRaw          = pooledCompletionRaw([...vendor, ...purchaser]);

  const percent          = Math.round(overallRaw);
  const vendorPercent    = Math.round(vendorRaw);
  const purchaserPercent = Math.round(purchaserRaw);

  // Twelve-week target anchors on the real sale start when a claim-reconciliation
  // effectiveStartDate is available (via phaseAware), else falls back to createdAt.
  // Elapsed-time + on-track calculations use the same anchor so claimed files
  // assess against the real timeline, not the moment the agent joined.
  const anchorDate = phaseAware?.effectiveStartDate ?? createdAt;
  const twelveWeekTargetRaw = new Date(anchorDate);
  twelveWeekTargetRaw.setDate(twelveWeekTargetRaw.getDate() + 84);
  const twelveWeekTarget = rollToBusinessDay(twelveWeekTargetRaw); // never a weekend

  // Active-only elapsed: subtract total on-hold ms so weeks-elapsed and the
  // velocity-based prediction freeze while paused. When no hold input is
  // provided, behaves identically to the original (raw msElapsed).
  const rawMsElapsed = now.getTime() - anchorDate.getTime();
  const msElapsed    = Math.max(0, rawMsElapsed - (hold?.holdMs ?? 0));
  const weeksElapsed = Math.floor(msElapsed / (7 * 86400000));
  const daysElapsed  = msElapsed / 86400000;

  let predictedExchangeDate: Date | null = null;
  let isEarlyEstimate = false;

  if (overridePredictedDate) {
    predictedExchangeDate = overridePredictedDate;
  } else if (phaseAware) {
    // Arc 2: phase-aware critical path model (see docs/forecasting/phase-aware-model-proposal.md)
    predictedExchangeDate = calculatePhaseAwarePrediction(phaseAware, createdAt);
    // isEarlyEstimate: file is still in Phase A (both VM4 and PM4 not yet complete).
    // Prediction will equal the 12-week target floor during this window.
    const done = new Set(phaseAware.completedMilestoneCodes);
    isEarlyEstimate = detectPhase(done).fileLevelPhase === "onboarding";
  } else if (daysElapsed < 28) {
    // Arc 1 fallback (no milestone codes available): linear velocity extrapolation is
    // dominated by the Phase A onboarding burst below 28 days — use the 12-week target.
    predictedExchangeDate = twelveWeekTarget;
    isEarlyEstimate = daysElapsed < 14;
  } else if (percent > 0) {
    const effectiveWeeks = Math.max(daysElapsed / 7, 1 / 7);
    const weeksTo100 = (effectiveWeeks / percent) * 100;
    const predicted = new Date(anchorDate);
    predicted.setDate(predicted.getDate() + Math.round(weeksTo100 * 7));
    predictedExchangeDate = predicted;
  } else {
    predictedExchangeDate = twelveWeekTarget;
  }

  // Exchange never lands on a weekend — roll every branch's result to a weekday.
  if (predictedExchangeDate) predictedExchangeDate = rollToBusinessDay(predictedExchangeDate);

  const msToExchange  = predictedExchangeDate!.getTime() - now.getTime();
  const weeksRemaining = Math.ceil(msToExchange / (7 * 86400000));

  let onTrack: ProgressResult["onTrack"] = "unknown";
  if (hold?.status === "on_hold") {
    // Frozen — at_risk/off_track signal is not meaningful while time isn't
    // ticking. UI renders a neutral "On hold" pill from this value.
    onTrack = "on_hold";
  } else if (percent > 0) {
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = overallRaw - expectedPercent;
    if (diff >= -10) onTrack = "on_track";
    else if (diff >= -25) onTrack = "at_risk";
    else onTrack = "off_track";
  }

  return {
    percent,
    vendorPercent,
    purchaserPercent,
    onTrack,
    twelveWeekTarget,
    predictedExchangeDate,
    isEarlyEstimate,
    weeksElapsed,
    daysElapsed: Math.floor(daysElapsed),
    weeksRemaining,
  };
}
