// UK Stamp Duty Land Tax (SDLT) — England & Northern Ireland only.
//
// Rates effective from 1 April 2025. Scotland (LBTT) and Wales (LTT) are
// SEPARATE taxes and are NOT covered here — the portal card carries a disclaimer.
// This is the single source of truth for the portal calculator: when the Budget
// moves the thresholds, edit the band tables below and nothing else.
//
// Out of scope (v1): non-UK-resident +2% surcharge, mixed-use / non-residential
// rates, linked transactions, multiple-dwellings relief. Always an estimate; the
// buyer's solicitor confirms the exact figure.

export type SdltInput = {
  /** Purchase price in whole pounds. */
  price: number;
  firstTimeBuyer: boolean;
  /** True if the buyer will own another residential property after completing. */
  additionalProperty: boolean;
};

export type SdltBand = {
  from: number;
  to: number | null; // null = top band, no upper limit
  rate: number;      // 0.05 = 5%
  taxed: number;     // slice of the price taxed at this rate
  tax: number;       // tax due on this slice
};

export type SdltResult = {
  total: number;         // whole pounds
  effectiveRate: number; // total / price, 0..1
  bands: SdltBand[];
};

// Standard residential rates (single home, not first-time buyer, not additional).
const STANDARD_BANDS: Array<{ threshold: number; rate: number }> = [
  { threshold: 0,          rate: 0 },
  { threshold: 125_000,    rate: 0.02 },
  { threshold: 250_000,    rate: 0.05 },
  { threshold: 925_000,    rate: 0.10 },
  { threshold: 1_500_000,  rate: 0.12 },
];

// First-time buyer relief — only applies when the price is at or below the cap.
const FTB_CAP = 500_000;
const FTB_BANDS: Array<{ threshold: number; rate: number }> = [
  { threshold: 0,        rate: 0 },
  { threshold: 300_000,  rate: 0.05 },
];

// Additional-property surcharge: +5% on every band, for purchases at or above
// the minimum. First-time-buyer relief and the surcharge never combine, so an
// additional-property purchase always uses the standard bands + surcharge.
const ADDITIONAL_SURCHARGE = 0.05;
const ADDITIONAL_MIN_PRICE = 40_000;

function bandsFor(input: SdltInput): Array<{ threshold: number; rate: number }> {
  const surcharge =
    input.additionalProperty && input.price >= ADDITIONAL_MIN_PRICE ? ADDITIONAL_SURCHARGE : 0;
  if (surcharge > 0) {
    return STANDARD_BANDS.map((b) => ({ threshold: b.threshold, rate: b.rate + surcharge }));
  }
  if (input.firstTimeBuyer && input.price <= FTB_CAP) {
    return FTB_BANDS;
  }
  return STANDARD_BANDS;
}

export function calculateSdlt(input: SdltInput): SdltResult {
  const price = Math.max(0, Math.round(input.price));
  const defs = bandsFor(input);
  const bands: SdltBand[] = [];
  let total = 0;

  for (let i = 0; i < defs.length; i++) {
    const from = defs[i].threshold;
    if (price <= from) break;
    const to = i + 1 < defs.length ? defs[i + 1].threshold : null;
    const upper = to === null ? price : Math.min(price, to);
    const taxed = Math.max(0, upper - from);
    if (taxed > 0) {
      const tax = taxed * defs[i].rate;
      bands.push({ from, to, rate: defs[i].rate, taxed, tax });
      total += tax;
    }
  }

  return {
    total: Math.round(total),
    effectiveRate: price > 0 ? total / price : 0,
    bands,
  };
}
