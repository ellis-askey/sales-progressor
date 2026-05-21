// lib/services/fees.ts
// Fee calculation and progress/exchange prediction logic.

import type { ClientType, Tenure, PurchaseType } from "@prisma/client";


// ─── Fee calculation ──────────────────────────────────────────────────────────

/**
 * Calculate our fee for a transaction.
 * Legacy agents have a fixed fee stored on their User record.
 * Standard agents use the sliding scale based on purchase price.
 */
export function calculateOurFee(
  clientType: ClientType,
  legacyFee: number | null,
  purchasePrice: number | null // in pence
): { fee: number | null; label: string } {
  if (clientType === "legacy") {
    if (!legacyFee) return { fee: null, label: "Legacy — fee not set" };
    return { fee: legacyFee, label: `Legacy fixed fee` };
  }

  // Standard sliding scale
  if (!purchasePrice) return { fee: null, label: "Standard — price not set" };

  const priceGBP = purchasePrice / 100;

  if (priceGBP < 350000) return { fee: 25000, label: "Standard (up to £349,999)" };       // £250
  if (priceGBP < 500000) return { fee: 30000, label: "Standard (£350k–£499k)" };          // £300
  return { fee: 35000, label: "Standard (£500k+)" };                                       // £350
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
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown";
  twelveWeekTarget: Date | null;
  predictedExchangeDate: Date | null;
  isEarlyEstimate: boolean; // true when still in Phase A (onboarding) and prediction is the 12-week target
  weeksElapsed: number;
  weeksRemaining: number | null;
  fileLevelPhase?: FileLevelPhase | null;
};

// ─── Phase-aware exchange forecast (Arc 2) ────────────────────────────────────
// Critical-path model per docs/forecasting/phase-aware-model-proposal.md.
// Conservative median durations — do not tighten until Level-3 data (50+ completed files).
// Confirmed values (Ellis, May 2026): PM11 ~10d, PM13 ~21d, PM9 7–21d (median 14d).
// All other values are range midpoints from the proposal doc.

export const MILESTONE_DURATION_MEDIANS: Record<string, number> = {
  // Vendor side (20 milestones)
  VM1: 1,  VM2: 1,  VM3: 3,  VM4: 8,  VM5: 2,  VM6: 17, VM7: 6,
  VM8: 1,  /* VM9: see isShareOfFreehold logic below */
  VM10: 14, VM11: 8,  VM12: 3,  VM13: 9,  VM14: 6,  VM15: 3,
  VM16: 13, VM17: 8,  VM18: 2,  VM19: 0,  VM20: 17,
  // Purchaser side (27 milestones)
  PM1: 1,  PM2: 1,  PM3: 8,  PM4: 6,  PM5: 3,  PM6: 9,  PM7: 13,
  PM8: 2,  PM9: 14, PM10: 14, PM11: 10, /* PM12: same as VM9 */
  PM13: 21, PM14: 14, PM15: 13, PM16: 3,  PM17: 9,  PM18: 13, PM19: 3,
  PM20: 2,  PM21: 6,  PM22: 3,  PM23: 8,  PM24: 3,  PM25: 2,  PM26: 0, PM27: 17,
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

  // Enquiries track (parallel from VM7): VM10 → VM11 → VM12 [+ VM13–VM15 per extra round]
  let enquiriesTrack = d("VM10") + d("VM11") + d("VM12");
  if (enquiryRounds >= 2) enquiriesTrack += d("VM13") + d("VM14") + d("VM15");
  if (enquiryRounds >= 3) enquiriesTrack += d("VM13") + d("VM14") + d("VM15");

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

  // Enquiries track: PM14 → PM17 → PM18 → PM19 [+ repeat for leasehold round 3]
  let enquiriesTrack = d("PM14") + d("PM17") + d("PM18") + d("PM19");
  if (enquiryRounds >= 3) enquiriesTrack += d("PM17") + d("PM18") + d("PM19");
  if (isCash) enquiriesTrack = Math.round(enquiriesTrack * 0.75);

  const parallelEnd = Math.max(mortgageTrack, searchTrack, enquiriesTrack);

  // Sequential pre-exchange chain: PM20 → PM21 → PM22 → PM23 → PM24 → PM25
  const preExchange = d("PM20") + d("PM21") + d("PM22") + d("PM23") + d("PM24") + d("PM25");

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

export function calculatePhaseAwarePrediction(
  input: PhaseAwareInput,
  createdAt: Date,
  overrideDate?: Date | null,
): Date {
  if (overrideDate) return overrideDate;

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

  // Floor: never predict earlier than the 12-week target
  return predicted > twelveWeekTarget ? predicted : twelveWeekTarget;
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
): ProgressResult {
  const now = new Date();

  const vendorRaw     = calcSideRaw(vendor);
  const purchaserRaw  = calcSideRaw(purchaser);

  // Pooled weighted progress: single ratio across all applicable milestones.
  // Each milestone contributes its weight to one shared denominator regardless of side.
  const allApplicable       = [...vendor, ...purchaser].filter((m) => !m.isNotRequired);
  const totalApplicable     = allApplicable.reduce((s, m) => s + m.weight, 0);
  const totalCompleted      = allApplicable.filter((m) => m.isComplete).reduce((s, m) => s + m.weight, 0);
  const overallRaw          = totalApplicable > 0 ? (totalCompleted / totalApplicable) * 100 : 100;

  const percent          = Math.round(overallRaw);
  const vendorPercent    = Math.round(vendorRaw);
  const purchaserPercent = Math.round(purchaserRaw);

  // Twelve-week target anchors on the real sale start when a claim-reconciliation
  // effectiveStartDate is available (via phaseAware), else falls back to createdAt.
  // Elapsed-time + on-track calculations use the same anchor so claimed files
  // assess against the real timeline, not the moment the agent joined.
  const anchorDate = phaseAware?.effectiveStartDate ?? createdAt;
  const twelveWeekTarget = new Date(anchorDate);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const msElapsed    = now.getTime() - anchorDate.getTime();
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

  const msToExchange  = predictedExchangeDate!.getTime() - now.getTime();
  const weeksRemaining = Math.ceil(msToExchange / (7 * 86400000));

  let onTrack: ProgressResult["onTrack"] = "unknown";
  if (percent > 0) {
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
    weeksRemaining,
  };
}
