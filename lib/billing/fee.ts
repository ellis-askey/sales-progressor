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
// lib/services/fees.ts has a legacy calculateOurFee that only knows
// outsourced tiers (clientType=standard). Left in place for any analytics
// that already reads it (we don't want to break the founder dashboards);
// it's not consumed by the billing path. This module is the only fee logic
// for billing going forward.

import type { ServiceType } from "@prisma/client";

const IN_HOUSE_FEE_PENCE = 5900;   // £59 inclusive (NOT VAT-registered today)
const OUTSOURCED_BAND_LOW_PENCE   = 25000; // £250 (price ≤ £349,999)
const OUTSOURCED_BAND_MID_PENCE   = 30000; // £300 (£350,000–£499,999)
const OUTSOURCED_BAND_HIGH_PENCE  = 35000; // £350 (≥ £500,000)
const BAND_MID_THRESHOLD_GBP   = 350000;
const BAND_HIGH_THRESHOLD_GBP  = 500000;

export type FeeKind = "in_house_fee" | "outsourced_fee";

export type FeeResult = {
  amountPence: number;
  kind: FeeKind;
  /** Human-readable band label for invoice line descriptions. */
  bandLabel: string;
};

/**
 * Compute the fee for a single exchanged file.
 *
 * Billing reads from PropertyTransaction.priceAtExchange (the snapshot taken
 * at VM19/PM26 completion — immune to later edits of purchasePrice). For
 * in-house files the price is irrelevant; the flat £59 applies.
 *
 * Returns amount in pence + a band label suitable for an InvoiceLine
 * description like "In-house file" or "Outsourced — £350,000–£499,999".
 */
export function computeFee(
  serviceType: ServiceType,
  priceAtExchangePence: number | null,
): FeeResult {
  if (serviceType === "self_managed") {
    return {
      amountPence: IN_HOUSE_FEE_PENCE,
      kind: "in_house_fee",
      bandLabel: "In-house file",
    };
  }

  // Outsourced. priceAtExchange should not be null for a billed outsourced
  // file (PR 3's stamp captures it), but defend defensively against future
  // edge cases by treating null as the bottom band rather than throwing.
  const priceGBP = (priceAtExchangePence ?? 0) / 100;

  if (priceGBP < BAND_MID_THRESHOLD_GBP) {
    return {
      amountPence: OUTSOURCED_BAND_LOW_PENCE,
      kind: "outsourced_fee",
      bandLabel: "Outsourced — up to £349,999",
    };
  }
  if (priceGBP < BAND_HIGH_THRESHOLD_GBP) {
    return {
      amountPence: OUTSOURCED_BAND_MID_PENCE,
      kind: "outsourced_fee",
      bandLabel: "Outsourced — £350,000–£499,999",
    };
  }
  return {
    amountPence: OUTSOURCED_BAND_HIGH_PENCE,
    kind: "outsourced_fee",
    bandLabel: "Outsourced — £500,000+",
  };
}
