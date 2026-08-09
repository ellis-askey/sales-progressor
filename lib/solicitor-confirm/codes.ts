// Which milestones a SOLICITOR is asked to confirm, split by side.
// Derived from the milestone labels + the client-copy `who:"solicitor"`
// classification (see docs/MILESTONES_SPEC_v1.md Responsibility rows and
// lib/portal-copy.ts). VM* codes route to the SELLER's solicitor, PM* to
// the BUYER's solicitor. Shared codes (issued to the client) are asked of
// BOTH the solicitor and the client — the client half is unchanged.
//
// Founder decisions 2026-08-09:
//   - "Ready to exchange" (VM18/PM25) is a solicitor confirmation → included.
//   - Property information forms / contract packs issued to the client
//     (VM5, VM16, PM22) go to the solicitor as well as the client.
//   - Welcome pack, ID/AML, mortgage app, survey, deposit, MOS: client only.
//   - Exchange + completion (VM19/PM26, VM20/PM27): nobody is asked.

export const VENDOR_SOLICITOR_CODES: ReadonlySet<string> = new Set([
  "VM5",  // property information forms issued to the seller (shared w/ client)
  "VM7",  // draft contract pack issued
  "VM8",  // management pack requested
  "VM9",  // management pack received
  "VM10", // initial enquiries received
  "VM12", // initial responses issued
  "VM13", // further enquiries received
  "VM15", // further responses issued
  "VM16", // contract documents issued to the seller (shared w/ client)
  "VM17", // signed contract documents received back
  "VM18", // ready to exchange
]);

export const PURCHASER_SOLICITOR_CODES: ReadonlySet<string> = new Set([
  "PM7",  // draft contract pack received
  "PM8",  // searches ordered
  "PM11", // mortgage offer received
  "PM12", // management pack received
  "PM13", // search results received
  "PM14", // initial enquiries raised
  "PM15", // initial replies received
  "PM16", // initial replies reviewed
  "PM17", // further enquiries raised
  "PM18", // further replies received
  "PM19", // further replies reviewed
  "PM20", // all enquiries satisfied
  "PM22", // contract documents issued to the buyer (shared w/ client)
  "PM23", // signed contract documents received back
  "PM25", // ready to exchange
]);

export type SolicitorSide = "vendor" | "purchaser";

export function solicitorCodesForSide(side: SolicitorSide): ReadonlySet<string> {
  return side === "vendor" ? VENDOR_SOLICITOR_CODES : PURCHASER_SOLICITOR_CODES;
}

// Short, solicitor-facing labels for the confirm page + emails. Deliberately
// plain and neutral — a solicitor reading these should recognise their own
// step at a glance. Falls back to the internal MilestoneDefinition.name when
// a code isn't listed here.
export const SOLICITOR_STEP_LABELS: Record<string, string> = {
  // Seller's solicitor
  VM5:  "Property information forms issued",
  VM7:  "Draft contract pack issued to the buyer's solicitor",
  VM8:  "Management pack requested",
  VM9:  "Management pack received",
  VM10: "Initial enquiries received from the buyer's solicitor",
  VM12: "Replies to initial enquiries issued",
  VM13: "Further enquiries received",
  VM15: "Replies to further enquiries issued",
  VM16: "Contract documents issued for signing",
  VM17: "Signed contract documents received back",
  VM18: "Ready to exchange",
  // Buyer's solicitor
  PM7:  "Draft contract pack received",
  PM8:  "Searches ordered",
  PM11: "Mortgage offer received",
  PM12: "Management pack received",
  PM13: "Search results received",
  PM14: "Initial enquiries raised with the seller's solicitor",
  PM15: "Replies to initial enquiries received",
  PM16: "Replies to initial enquiries reviewed",
  PM17: "Further enquiries raised",
  PM18: "Replies to further enquiries received",
  PM19: "Replies to further enquiries reviewed",
  PM20: "All enquiries satisfied",
  PM22: "Contract documents issued for signing",
  PM23: "Signed contract documents received back",
  PM25: "Ready to exchange",
};

export function solicitorStepLabel(code: string, fallback: string): string {
  return SOLICITOR_STEP_LABELS[code] ?? fallback;
}
