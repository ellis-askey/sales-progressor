// Auto-NR shape suppression audit.
//
// For each of 6 shapes, lists which codes are auto-marked Not Required.
// Cross-check against expected (Phase 5 mortgage-only, Phase 7 leasehold-
// only, PM24 not on cash_from_proceeds).

import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "cash_buyer" | "mortgage" | "cash_from_proceeds";

const SHAPES: Array<[Tenure, PurchaseType]> = [
  ["freehold", "cash_buyer"], ["freehold", "mortgage"], ["freehold", "cash_from_proceeds"],
  ["leasehold", "cash_buyer"], ["leasehold", "mortgage"], ["leasehold", "cash_from_proceeds"],
];

const EXPECTED: Record<string, Record<string, boolean>> = {
  "freehold:cash_buyer":  { PM5: true,  PM6: true,  PM11: true,  VM8: true,  VM9: true,  PM12: true, PM24: false },
  "freehold:mortgage":    { PM5: false, PM6: false, PM11: false, VM8: true,  VM9: true,  PM12: true, PM24: false },
  "freehold:cash_from_proceeds": { PM5: true, PM6: true, PM11: true, VM8: true, VM9: true, PM12: true, PM24: true },
  "leasehold:cash_buyer": { PM5: true,  PM6: true,  PM11: true,  VM8: false, VM9: false, PM12: false, PM24: false },
  "leasehold:mortgage":   { PM5: false, PM6: false, PM11: false, VM8: false, VM9: false, PM12: false, PM24: false },
  "leasehold:cash_from_proceeds": { PM5: true, PM6: true, PM11: true, VM8: false, VM9: false, PM12: false, PM24: true },
};

let failures = 0;
const CODES_TO_CHECK = ["PM5", "PM6", "PM11", "VM8", "VM9", "PM12", "PM24"];

for (const [t, pt] of SHAPES) {
  const key = `${t}:${pt}`;
  const autoNr = computeAutoNrCodes(pt, t);
  console.log(`\n=== ${key} (${autoNr.size} auto-NR codes total) ===`);
  for (const code of CODES_TO_CHECK) {
    const isNr = autoNr.has(code);
    const expectedNr = EXPECTED[key][code];
    const status = isNr === expectedNr ? "✓" : "⚠️";
    if (isNr !== expectedNr) failures++;
    console.log(`  ${status} ${code}: ${isNr ? "auto-NR (suppressed)" : "fires"} (expected ${expectedNr ? "suppressed" : "fires"})`);
  }
}

// Defensive VM9 freehold check: even though Phase 7 is auto-NR'd on
// freehold, VM9.purchaser was added in Job B with tenure-gated sections.
// If auto-NR is bypassed (programmatically completed), would the
// purchaser fan-out still safely skip? Yes IF resolveRecipientCopy
// returns null for empty assembled output. Today it returns a truthy
// object with empty fields — flagged in Section 1.
console.log(`\n\nSummary: ${failures === 0 ? "✓ all auto-NR expectations match" : `⚠️ ${failures} mismatches`}`);
