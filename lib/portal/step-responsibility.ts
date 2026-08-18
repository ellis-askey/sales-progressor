// Which milestone steps the "email your conveyancer" follow-up lights up for.
//
// These are the steps where the client's OWN solicitor holds the work (from the
// milestone glossary "who is responsible"), so a nudge to their conveyancer
// makes sense. The enquiries stretch is handled separately off the enquiry
// tracker's whose-court state, not from this map.
//
// See docs/active/client-solicitor-followup-sender-SPEC.md.

export type FollowupSide = "vendor" | "purchaser";

export type FollowupStep = {
  code: string;
  side: FollowupSide;
  // Plain-English noun phrase used in the email body ("...an update on {thing}").
  thing: string;
  // Short subject stem; the property address is appended by the copy builder.
  subject: string;
  // Leasehold-only steps naturally only surface on leasehold files (they're
  // auto-not-required on freehold), but we note it for clarity.
  leasehold?: boolean;
};

// Ordered by where they sit in the journey (used to pick the current frontier).
export const FOLLOWUP_STEPS: FollowupStep[] = [
  // Seller (emails their own conveyancer)
  { code: "VM3", side: "vendor", thing: "the welcome pack from your solicitor", subject: "Welcome pack" },
  { code: "VM5", side: "vendor", thing: "the property information (protocol) forms", subject: "Protocol forms" },
  { code: "VM8", side: "vendor", thing: "the management pack request", subject: "Management pack", leasehold: true },
  { code: "VM7", side: "vendor", thing: "the draft contract pack going to the buyer's side", subject: "Draft contract pack" },
  { code: "VM9", side: "vendor", thing: "the management pack from the freeholder", subject: "Management pack", leasehold: true },
  { code: "VM16", side: "vendor", thing: "the contract documents for signing", subject: "Contract documents" },
  { code: "VM18", side: "vendor", thing: "confirming you are ready to exchange", subject: "Ready to exchange" },
  // Buyer (emails their own conveyancer)
  { code: "PM7", side: "purchaser", thing: "the draft contract pack coming over from the seller's side", subject: "Draft contract pack" },
  { code: "PM8", side: "purchaser", thing: "the property searches", subject: "Searches" },
  { code: "PM12", side: "purchaser", thing: "the management pack from the seller's side", subject: "Management pack", leasehold: true },
  { code: "PM13", side: "purchaser", thing: "the search results", subject: "Search results" },
  { code: "PM21", side: "purchaser", thing: "the final report on your purchase", subject: "Final report" },
  { code: "PM22", side: "purchaser", thing: "the contract documents for signing", subject: "Contract documents" },
  { code: "PM25", side: "purchaser", thing: "confirming you are ready to exchange", subject: "Ready to exchange" },
];

const BY_CODE = new Map(FOLLOWUP_STEPS.map((s) => [s.code, s]));

export function followupStep(code: string): FollowupStep | null {
  return BY_CODE.get(code) ?? null;
}

export function isFollowupStep(code: string, side: FollowupSide): boolean {
  const s = BY_CODE.get(code);
  return !!s && s.side === side;
}

export const FOLLOWUP_STEP_CODES: ReadonlySet<string> = new Set(FOLLOWUP_STEPS.map((s) => s.code));
