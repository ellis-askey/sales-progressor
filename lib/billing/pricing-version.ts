// The pricing rules currently in force. Stamped onto every new sale
// (PropertyTransaction.pricingVersion) at create so a future reprice never
// silently re-prices in-flight sales, and history stays auditable (D7).
//
// Bump this string whenever the fee schedule changes. Existing rows keep the
// version they were created under; the backfill labelled pre-migration rows
// "legacy_2026_paid_self".
export const CURRENT_PRICING_VERSION = "2026-08_free_self";
