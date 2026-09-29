// Friendly "Waiting on ___" fragment per exchange-gating step, for the
// FileHealthBanner "exchange running behind target" slip warning (critique #8,
// 2026-09-29). Keyed by milestone code; each value slots straight after
// "Waiting on " and reads as a natural noun phrase (e.g. "the deposit transfer").
// Falls back to the raw milestone name for any code not listed, so the banner
// never breaks if the step set changes.

const EXCHANGE_BLOCKER_LABELS: Record<string, string> = {
  // Seller side
  VM1: "the seller to instruct their solicitor",
  VM2: "the seller's memorandum of sale",
  VM3: "the seller's welcome pack",
  VM4: "the seller's ID checks",
  VM5: "the seller's property forms to be sent out",
  VM6: "the seller's completed property forms",
  VM7: "the draft contract pack",
  VM8: "the management pack to be requested",
  VM9: "the management pack",
  VM10: "the initial enquiries",
  VM16: "the seller's contract to sign",
  VM17: "the seller's signed contract",
  VM21: "all enquiries to be satisfied",
  // Buyer side
  PM1: "the buyer to instruct their solicitor",
  PM2: "the buyer's memorandum of sale",
  PM3: "the buyer's ID checks",
  PM4: "the buyer's money on account",
  PM5: "the buyer's mortgage application",
  PM6: "the lender's valuation to be booked",
  PM7: "the contract pack to reach the buyer's solicitor",
  PM8: "searches to be ordered",
  PM9: "the buyer's survey to be booked",
  PM10: "the survey report",
  PM11: "the mortgage offer",
  PM12: "the management pack (buyer's side)",
  PM13: "the search results",
  PM14: "enquiries to be raised",
  PM20: "all enquiries to be satisfied",
  PM21: "the buyer's final report",
  PM22: "the buyer's contract to sign",
  PM23: "the buyer's signed contract",
  PM24: "the deposit transfer",
};

export function exchangeBlockerLabel(
  code: string | null | undefined,
  fallbackName: string | null,
): string | null {
  if (code && EXCHANGE_BLOCKER_LABELS[code]) return EXCHANGE_BLOCKER_LABELS[code];
  return fallbackName;
}
