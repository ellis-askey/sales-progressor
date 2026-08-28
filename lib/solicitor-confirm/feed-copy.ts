// Solicitor-audience copy for the solicitor portal's Progress mirror + Updates
// feed. The client portal's copy (lib/portal-copy.ts) is written TO the client
// ("Your solicitor has ordered the searches", "You've instructed your
// solicitor") — read back to the solicitor who did the work, that's wrong. These
// maps re-voice the OWN side neutrally, in the past tense, about the matter, so
// a solicitor recognises their own file at a glance. The OTHER side's copy is
// already third-person about the counterparty and reads fine, so it stays on
// lib/portal-copy.ts with only a couple of "your solicitor" overrides below.
//
// Voice (Law 21): no "your solicitor" / "you", no system self-references, no
// em-dashes, no exclamation marks. Founder-authored 2026-08-28.

// Short labels for the Progress-mirror OWN side (one line per milestone).
const SOLICITOR_OWN_LABEL: Record<string, string> = {
  // Seller's solicitor
  VM1: "Instructed on the sale",
  VM2: "Memorandum of sale received",
  VM3: "Client care pack issued to the seller",
  VM4: "Seller ID and AML checks complete",
  VM5: "Property information forms issued",
  VM6: "Property forms returned by the seller",
  VM7: "Draft contract pack issued to the buyer's solicitor",
  VM8: "Management pack requested",
  VM9: "Management pack received",
  VM10: "Initial enquiries received from the buyer's solicitor",
  VM21: "All enquiries satisfied",
  VM16: "Contract documents issued for signing",
  VM17: "Signed contract documents received back",
  VM18: "Ready to exchange",
  VM19: "Contracts exchanged",
  VM20: "Completion",
  // Buyer's solicitor
  PM1: "Instructed on the purchase",
  PM2: "Memorandum of sale received",
  PM3: "Buyer ID, AML and source of funds checks complete",
  PM4: "Funds on account received",
  PM5: "Mortgage application submitted",
  PM6: "Mortgage valuation arranged",
  PM11: "Mortgage offer received",
  PM9: "Survey arranged",
  PM10: "Survey report received",
  PM7: "Draft contract pack received",
  PM8: "Searches ordered",
  PM12: "Management pack received",
  PM13: "Search results received",
  PM14: "Initial enquiries raised with the seller's solicitor",
  PM20: "All enquiries satisfied",
  PM21: "Report on title issued to the buyer",
  PM22: "Contract documents issued for signing",
  PM23: "Signed contract documents received back",
  PM24: "Exchange deposit received",
  PM25: "Ready to exchange",
  PM26: "Contracts exchanged",
  PM27: "Completion",
};

// Fluent sentences for the Updates feed OWN side (the "what happened" line).
const SOLICITOR_OWN_SUBTEXT: Record<string, string> = {
  // Seller's solicitor
  VM1: "The file has been opened and the legal work on the sale is underway.",
  VM2: "The memorandum of sale has been received, confirming the agreed terms.",
  VM3: "The client care pack and initial paperwork have been issued to the seller.",
  VM4: "The identity and anti-money laundering checks on the seller are complete.",
  VM5: "The property information forms have been sent to the seller to complete.",
  VM6: "The seller's completed property forms are back and ready for the contract pack.",
  VM7: "The draft contract pack has been issued to the buyer's solicitor.",
  VM8: "The management information pack has been requested from the freeholder or managing agent.",
  VM9: "The management information pack has been received.",
  VM10: "The buyer's solicitor's initial enquiries have been received and are being worked through.",
  VM21: "The buyer's solicitor has confirmed all enquiries are answered to their satisfaction.",
  VM16: "The contract and transfer deed have been sent to the seller to sign.",
  VM17: "The seller's signed contract documents are back and ready for exchange.",
  VM18: "Everything is in place on this side to exchange contracts.",
  VM19: "Contracts have been exchanged and the sale is now legally binding.",
  VM20: "Completion has taken place and the sale is complete.",
  // Buyer's solicitor
  PM1: "The file has been opened and the legal work on the purchase is underway.",
  PM2: "The memorandum of sale has been received, confirming the agreed terms.",
  PM3: "The identity, anti-money laundering and source of funds checks on the buyer are complete.",
  PM4: "The initial funds on account for searches and disbursements have been received.",
  PM5: "The buyer's full mortgage application has been submitted to the lender.",
  PM6: "The lender has arranged its mortgage valuation of the property.",
  PM11: "The mortgage offer has been issued and a copy received on file.",
  PM9: "The buyer's survey of the property has been arranged.",
  PM10: "The buyer's survey report has been received.",
  PM7: "The draft contract pack has been received and is under review.",
  PM8: "The property searches have been ordered.",
  PM12: "The management information pack has been received and is under review.",
  PM13: "All search results have been received and are being reviewed.",
  PM14: "The initial enquiries have been raised with the seller's solicitor.",
  PM20: "The replies to all enquiries have been reviewed and are satisfactory.",
  PM21: "The report on title has been issued to the buyer.",
  PM22: "The contract and transfer deed have been sent to the buyer to sign.",
  PM23: "The buyer's signed contract documents are back and ready for exchange.",
  PM24: "The exchange deposit has been received.",
  PM25: "Everything is in place on this side to exchange contracts.",
  PM26: "Contracts have been exchanged and the purchase is now legally binding.",
  PM27: "Completion has taken place and the purchase is complete.",
};

// The few OTHER-side sentences on lib/portal-copy.ts that say "your solicitor"
// (meaning the viewer). Re-voiced for a solicitor reader.
const SOLICITOR_OTHER_SUBTEXT_OVERRIDE: Record<string, string> = {
  VM7: "The seller's solicitor has issued the draft contract pack for your review.",
  VM10: "The seller's solicitor has received your initial enquiries and can begin working through the replies.",
  VM21: "The replies to all enquiries have been accepted as satisfactory. This is a significant step towards being ready to exchange.",
};

export function solicitorOwnLabel(code: string, fallback: string): string {
  return SOLICITOR_OWN_LABEL[code] ?? fallback;
}

export function solicitorOwnSubtext(code: string): string | null {
  return SOLICITOR_OWN_SUBTEXT[code] ?? null;
}

export function solicitorOtherSubtextOverride(code: string): string | null {
  return SOLICITOR_OTHER_SUBTEXT_OVERRIDE[code] ?? null;
}
