// lib/billing/fee.ts
//
// Single source of truth for "what do we charge for an exchanged file?"
// Consumed by:
//   - lib/billing/accrual.ts (forward — writes InvoiceLine rows)
//   - lib/services/billing-reversal.ts (reverse — writes CreditNote amount)
//   - lib/billing/running-total.ts (the director's live page total)
//
// The £59 in-house fee and the £250/£300/£350 outsourced tier amounts now
// live in exactly one place. Two copies of a money number drifting apart is
// its own bug class — closed in PR 5.
//
// PR 8 adds VAT split awareness. The total stays the same regardless of VAT
// registration; the SPLIT changes for invoice presentation. With
// vatRegisteredAt set, a £59 in-house fee renders as £49.17 ex-VAT + £9.83
// VAT (at 20%). Without it, vatPence = 0 and amountPence = total. Cleanly
// flippable via a single config field on Agency.

import type { ClientType, ServiceType } from "@prisma/client";

const IN_HOUSE_FEE_PENCE = 5900;   // £59 inclusive (NOT VAT-registered today)
const OUTSOURCED_BAND_LOW_PENCE   = 25000; // £250 (price ≤ £349,999)
const OUTSOURCED_BAND_MID_PENCE   = 30000; // £300 (£350,000–£499,999)
const OUTSOURCED_BAND_HIGH_PENCE  = 35000; // £350 (≥ £500,000)
const BAND_MID_THRESHOLD_GBP   = 350000;
const BAND_HIGH_THRESHOLD_GBP  = 500000;

export type FeeKind = "in_house_fee" | "outsourced_fee";

/**
 * VAT input — captured from Agency.vatRegisteredAt + Agency.vatRateBps. Pass
 * `null` (or omit) for "not VAT-registered" — the default behaviour with
 * vatPence = 0 and the full fee in amountPence.
 */
export type VatInput = {
  vatRegisteredAt: Date | null;
  vatRateBps: number | null; // basis points: 2000 = 20%
} | null;

/**
 * Per-agency outsourced-fee override — captured from Agency.feeTier +
 * Agency.legacyOutsourcedFeePence. When feeTier is "legacy" and the pence
 * value is set, that flat amount replaces the £250/£300/£350 sliding scale
 * for outsourced files. Self-managed (£59) is never affected — matches the
 * policy in lib/services/fees.ts:calculateOurFee.
 */
export type AgencyFeeOverride = {
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
} | null;

export type FeeResult = {
  /** Ex-VAT portion (when registered) OR full inclusive amount (when not). */
  amountPence: number;
  /** VAT portion. 0 when not registered. */
  vatPence: number;
  /** Always equals amountPence + vatPence; equals the gross to charge. */
  totalPence: number;
  kind: FeeKind;
  /** Human-readable band label for invoice line descriptions. */
  bandLabel: string;
};

function grossFee(
  serviceType: ServiceType,
  priceAtExchangePence: number | null,
  agencyOverride: AgencyFeeOverride,
): { totalPence: number; kind: FeeKind; bandLabel: string } {
  if (serviceType === "self_managed") {
    return { totalPence: IN_HOUSE_FEE_PENCE, kind: "in_house_fee", bandLabel: "In-house file" };
  }
  // Outsourced. Per-agency legacy override wins when configured — the agency
  // pays a flat fee regardless of sale price. Self-managed (£59) is
  // intentionally unaffected above.
  if (agencyOverride?.feeTier === "legacy") {
    if (agencyOverride.legacyOutsourcedFeePence != null) {
      return {
        totalPence: agencyOverride.legacyOutsourcedFeePence,
        kind: "outsourced_fee",
        bandLabel: "Outsourced — legacy fixed fee",
      };
    }
    // Data error: legacy tier without a configured pence amount. Falling
    // through to the sliding scale at least emits a known-good number;
    // a thrown error here would brick the accrual cron. Surface loudly.
    console.warn(
      "[billing/fee] Agency feeTier='legacy' but legacyOutsourcedFeePence is null — falling back to sliding scale.",
    );
  }
  // priceAtExchange should not be null for a billed outsourced file (PR 3's
  // stamp captures it), but defend defensively by treating null as the
  // bottom band rather than throwing.
  const priceGBP = (priceAtExchangePence ?? 0) / 100;
  if (priceGBP < BAND_MID_THRESHOLD_GBP) {
    return { totalPence: OUTSOURCED_BAND_LOW_PENCE, kind: "outsourced_fee", bandLabel: "Outsourced — up to £349,999" };
  }
  if (priceGBP < BAND_HIGH_THRESHOLD_GBP) {
    return { totalPence: OUTSOURCED_BAND_MID_PENCE, kind: "outsourced_fee", bandLabel: "Outsourced — £350,000–£499,999" };
  }
  return { totalPence: OUTSOURCED_BAND_HIGH_PENCE, kind: "outsourced_fee", bandLabel: "Outsourced — £500,000+" };
}

/**
 * Compute the fee for a single exchanged file, optionally splitting into
 * ex-VAT + VAT components when the agency is VAT-registered.
 *
 * Math when registered:
 *   amountPence = round(totalPence / (1 + vatRate))
 *   vatPence    = totalPence - amountPence
 * Rounding bias is on the VAT side so amountPence stays at the "clean"
 * number (e.g. £49.17 ex-VAT vs £9.83 VAT on a £59 gross at 20%).
 *
 * When NOT registered (or vatRateBps is null): amountPence = totalPence,
 * vatPence = 0. Identical to the pre-PR-8 behaviour.
 */
export function computeFee(
  serviceType: ServiceType,
  priceAtExchangePence: number | null,
  vat: VatInput = null,
  agencyOverride: AgencyFeeOverride = null,
): FeeResult {
  const { totalPence, kind, bandLabel } = grossFee(serviceType, priceAtExchangePence, agencyOverride);

  const vatActive = vat !== null && vat.vatRegisteredAt !== null && vat.vatRateBps !== null && vat.vatRateBps > 0;
  if (!vatActive) {
    return { amountPence: totalPence, vatPence: 0, totalPence, kind, bandLabel };
  }

  // vat is non-null and vatRateBps is non-null and > 0 here, narrowed by vatActive.
  const rate = (vat!.vatRateBps as number) / 10000; // 2000 bps → 0.20
  const amountPence = Math.round(totalPence / (1 + rate));
  const vatPence = totalPence - amountPence;
  return { amountPence, vatPence, totalPence, kind, bandLabel };
}
