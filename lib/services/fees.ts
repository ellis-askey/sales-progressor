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
  weeksElapsed: number;
  weeksRemaining: number | null;
};

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
  overridePredictedDate?: Date | null
): ProgressResult {
  const now = new Date();

  const vendorRaw     = calcSideRaw(vendor);
  const purchaserRaw  = calcSideRaw(purchaser);
  const overallRaw    = (vendorRaw + purchaserRaw) / 2;

  const percent          = Math.round(overallRaw);
  const vendorPercent    = Math.round(vendorRaw);
  const purchaserPercent = Math.round(purchaserRaw);

  const twelveWeekTarget = new Date(createdAt);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const msElapsed    = now.getTime() - createdAt.getTime();
  const weeksElapsed = Math.floor(msElapsed / (7 * 86400000));
  const daysElapsed  = msElapsed / 86400000;

  let predictedExchangeDate: Date | null = null;
  if (overridePredictedDate) {
    predictedExchangeDate = overridePredictedDate;
  } else if (percent > 0 && daysElapsed >= 1) {
    const effectiveWeeks = Math.max(daysElapsed / 7, 1 / 7);
    const weeksTo100 = (effectiveWeeks / percent) * 100;
    const predicted = new Date(createdAt);
    predicted.setDate(predicted.getDate() + Math.round(weeksTo100 * 7));
    predictedExchangeDate = predicted;
  } else {
    predictedExchangeDate = twelveWeekTarget;
  }

  const msToExchange  = predictedExchangeDate.getTime() - now.getTime();
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
    weeksElapsed,
    weeksRemaining,
  };
}
