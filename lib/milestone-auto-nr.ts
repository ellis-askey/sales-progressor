// Canonical "which milestones auto-NR for which tenure+purchaseType combo?"
// rule. Pure data module, no server imports — safe for both server (init,
// edit-sale-details cascade) and client (ReconcileMilestonePicker mirror).
//
// Single source of truth. Adding a new auto-NR rule means editing this file
// and nothing else — the three consumers (initializeMilestoneCompletions in
// lib/services/milestones.ts, confirmSaleDetailsAction in app/actions/
// transactions.ts, autoNrCodesFor in components/milestones/
// ReconcileMilestonePicker.tsx) all import from here.
//
// Rules currently encoded:
//   tenure = freehold                     -> VM8, VM9, PM12  (no management pack)
//   purchaseType = cash_buyer             -> PM5, PM6, PM11  (no mortgage)
//   purchaseType = cash_from_proceeds     -> PM5, PM6, PM11  (no mortgage)
//                                         + PM24             (deposit comes from
//                                                              concurrent-sale
//                                                              equity, not pre-
//                                                              exchange transfer)

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

// Exposed for the comms-text branching in confirmSaleDetailsAction — it needs
// to know whether a reversed milestone code was tenure-driven or
// purchaseType-driven to produce the right "changed from X to Y" wording.
export const FREEHOLD_NR_CODES = new Set(["VM8", "VM9", "PM12"]);
export const PURCHASE_TYPE_NR_CODES = new Set(["PM5", "PM6", "PM11", "PM24"]);

export function computeAutoNrCodes(
  purchaseType: PurchaseType | null | undefined,
  tenure: Tenure | null | undefined,
): Set<string> {
  const codes = new Set<string>();
  if (tenure === "freehold") {
    for (const c of FREEHOLD_NR_CODES) codes.add(c);
  }
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    codes.add("PM5");
    codes.add("PM6");
    codes.add("PM11");
  }
  if (purchaseType === "cash_from_proceeds") {
    // Deposit milestone: buyer's deposit comes from the equity locked in their
    // own concurrent sale, so there's no pre-exchange deposit transfer to track.
    // Distinct from cash_buyer (has cash savings, pays deposit normally).
    codes.add("PM24");
  }
  return codes;
}
