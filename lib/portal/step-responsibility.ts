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
// `thing` is always a BARE NOUN so it reads cleanly inside "{thing} for {address}"
// in every template (no trailing prepositions, no verb phrases).
export const FOLLOWUP_STEPS: FollowupStep[] = [
  // Seller (emails their own conveyancer)
  { code: "VM3", side: "vendor", thing: "the welcome pack", subject: "Welcome pack" },
  { code: "VM5", side: "vendor", thing: "the property information forms", subject: "Property information forms" },
  { code: "VM8", side: "vendor", thing: "the management pack", subject: "Management pack", leasehold: true },
  { code: "VM7", side: "vendor", thing: "the draft contract pack", subject: "Draft contract pack" },
  { code: "VM9", side: "vendor", thing: "the management pack", subject: "Management pack", leasehold: true },
  { code: "VM16", side: "vendor", thing: "the contract documents", subject: "Contract documents" },
  { code: "VM18", side: "vendor", thing: "the exchange of contracts", subject: "Exchange" },
  // Buyer (emails their own conveyancer)
  { code: "PM7", side: "purchaser", thing: "the draft contract pack", subject: "Draft contract pack" },
  { code: "PM8", side: "purchaser", thing: "the searches", subject: "Searches" },
  { code: "PM12", side: "purchaser", thing: "the management pack", subject: "Management pack", leasehold: true },
  { code: "PM13", side: "purchaser", thing: "the search results", subject: "Search results" },
  { code: "PM21", side: "purchaser", thing: "the final report", subject: "Final report" },
  { code: "PM22", side: "purchaser", thing: "the contract documents", subject: "Contract documents" },
  { code: "PM25", side: "purchaser", thing: "the exchange of contracts", subject: "Exchange" },
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
