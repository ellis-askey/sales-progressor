// The pricing rules currently in force. Stamped onto every new sale
// (PropertyTransaction.pricingVersion) at create so a future reprice never
// silently re-prices in-flight sales, and history stays auditable (D7).
//
// Bump this string whenever the fee schedule changes. Existing rows keep the
// version they were created under; the backfill labelled pre-migration rows
// "legacy_2026_paid_self".
export const CURRENT_PRICING_VERSION = "2026-08_free_self";

// Outsourced-sunset model (docs/active/outsourced-sunset/). A flat £50 per
// exchange for every agent sale, no bands, no automatic free (free is a
// deliberate per-sale grant via freeOnExchange). Stamped on NEW sales only when
// the master switch is off (createTransaction decides) — so it never touches a
// sale created under the old free-self model, and the moment of change is the
// single switch flip. isFlatFiftyVersion() is the predicate every fee reader
// uses to value these files at £50 instead of the serviceType default.
export const PRICING_VERSION_FLAT_FIFTY = "2027-01_flat_fifty";

// The flat per-exchange fee, in pence. Lives beside the version it belongs to.
export const FLAT_EXCHANGE_FEE_PENCE = 5000; // £50

export function isFlatFiftyVersion(pricingVersion: string | null | undefined): boolean {
  return pricingVersion === PRICING_VERSION_FLAT_FIFTY;
}
