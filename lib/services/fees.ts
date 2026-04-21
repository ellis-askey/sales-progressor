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

// ─── Milestone weights ────────────────────────────────────────────────────────
// 2-5 scale. Recalibrates to 100% excluding not-required milestones.
// Post-exchange milestones (PM16/17/VM12/13) excluded from progress calc.

export const MILESTONE_WEIGHTS: Record<string, number> = {
  // VENDOR — weight 5
  "VM5":  5, // Draft contract pack issued
  "VM11": 5, // Signed contracts returned
  "VM20": 5, // Ready to exchange (gate)

  // VENDOR — weight 4
  "VM4":  4, // Property info forms returned
  "VM7":  4, // Management pack received
  "VM8":  4, // Initial replies issued
  "VM9":  4, // Further replies issued
  "VM10": 4, // Contract documents issued
  "VM16": 4, // Initial enquiries received
  "VM17": 4, // Initial replies provided to solicitor
  "VM18": 4, // Further enquiries received
  "VM19": 4, // Further replies provided to solicitor

  // VENDOR — weight 3
  "VM1":  3, // Solicitor instructed
  "VM3":  3, // Welcome pack received
  "VM14": 3, // ID & AML completed
  "VM15": 3, // Property info forms received
  "VM17b":3, // (fallback)

  // VENDOR — weight 2
  "VM2":  2, // MOS received
  "VM6":  2, // Management pack requested
  "VM12": 2, // Exchanged (post-exchange, lower weight)
  "VM13": 2, // Completed (post-exchange)

  // PURCHASER — weight 5
  "PM3":  5, // Draft contract pack received
  "PM6":  5, // Mortgage offer received
  "PM25": 5, // All enquiries satisfied
  "PM14b":5, // Signed contracts returned
  "PM27": 5, // Ready to exchange (gate)

  // PURCHASER — weight 4
  "PM9":  4, // Searches ordered
  "PM10": 4, // Searches received
  "PM11": 4, // Initial enquiries raised
  "PM21": 4, // Initial replies received
  "PM22": 4, // Initial replies reviewed
  "PM12": 4, // Further enquiries raised
  "PM23": 4, // Further replies received
  "PM24": 4, // Further replies reviewed
  "PM13": 4, // Contract documents received
  "PM15b":4, // Deposit transferred

  // PURCHASER — weight 3
  "PM1":  3, // Solicitor instructed
  "PM14a":3, // ID & AML completed
  "PM15a":3, // Money on account
  "PM20": 3, // Survey report received
  "PM26": 3, // Final report received
  "PM8":  3, // Management pack received (buyer)

  // PURCHASER — weight 2
  "PM2":  2, // MOS received
  "PM4":  2, // Mortgage application submitted
  "PM5":  2, // Valuation booked
  "PM7":  2, // Survey booked
  "PM16": 2, // Exchanged
  "PM17": 2, // Completed
};

// ─── Progress calculation ──────────────────────────────────────────────────────

export type ProgressResult = {
  percent: number;
  completedWeight: number;
  totalWeight: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown";
  twelveWeekTarget: Date | null;
  predictedExchangeDate: Date | null;
  weeksElapsed: number;
  weeksRemaining: number | null;
};

type MilestoneState = {
  code: string;
  isComplete: boolean;
  isNotRequired: boolean;
  isPostExchange: boolean;
  completedAt?: Date;
};

/**
 * Calculate weighted progress and exchange prediction.
 * Excludes not-required milestones from total weight (recalibrates to 100%).
 * Excludes post-exchange milestones from progress calculation.
 */
export function calculateProgress(
  milestones: MilestoneState[],
  createdAt: Date,
  overridePredictedDate?: Date | null
): ProgressResult {
  const now = new Date();

  // Filter out post-exchange for progress calc
  const applicable = milestones.filter((m) => !m.isPostExchange);

  // Active milestones (not marked not-required)
  const active = applicable.filter((m) => !m.isNotRequired);

  const totalWeight = active.reduce((sum, m) => sum + (MILESTONE_WEIGHTS[m.code] ?? 2), 0);
  const completedWeight = active
    .filter((m) => m.isComplete)
    .reduce((sum, m) => sum + (MILESTONE_WEIGHTS[m.code] ?? 2), 0);

  const percent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  // 12-week target
  const twelveWeekTarget = new Date(createdAt);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  // Weeks elapsed since file creation
  const msElapsed = now.getTime() - createdAt.getTime();
  const weeksElapsed = Math.floor(msElapsed / (7 * 86400000));

  // Predicted exchange date based on velocity
  let predictedExchangeDate: Date | null = null;

  if (overridePredictedDate) {
    predictedExchangeDate = overridePredictedDate;
  } else if (percent > 0 && weeksElapsed > 0) {
    // If we're X% done in Y weeks, extrapolate to 100%
    const weeksTo100 = (weeksElapsed / percent) * 100;
    const predicted = new Date(createdAt);
    predicted.setDate(predicted.getDate() + Math.round(weeksTo100 * 7));
    predictedExchangeDate = predicted;
  } else {
    // No progress yet — default to 12 week target
    predictedExchangeDate = twelveWeekTarget;
  }

  // Weeks remaining to predicted exchange
  const msToExchange = predictedExchangeDate.getTime() - now.getTime();
  const weeksRemaining = Math.ceil(msToExchange / (7 * 86400000));

  // On-track assessment vs 12-week target
  let onTrack: ProgressResult["onTrack"] = "unknown";
  if (percent > 0) {
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = percent - expectedPercent;
    if (diff >= -10) onTrack = "on_track";
    else if (diff >= -25) onTrack = "at_risk";
    else onTrack = "off_track";
  }

  return {
    percent,
    completedWeight,
    totalWeight,
    onTrack,
    twelveWeekTarget,
    predictedExchangeDate,
    weeksElapsed,
    weeksRemaining,
  };
}
