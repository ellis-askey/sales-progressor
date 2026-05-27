// Canonical journey order — every milestone code in the order a real
// transaction progresses through them. Used by the snapshot tool's
// per-shape journey docs so the rendered output reads as the client's
// chronological inbox experience.
//
// Phases mirror the milestone-completion-email-inventory.md grouping.
// Within a phase, codes are listed in the order events happen in
// practice (issuer-side first where bilateral; otherwise low-to-high
// orderIndex).

export const JOURNEY_ORDER: readonly string[] = [
  // Phase 1 — Instruction
  "VM1", "PM1",
  // Phase 2 — Memorandum of sale
  "VM2", "PM2",
  // Phase 3 — Welcome pack, ID/AML, money on account
  "VM3", "VM4", "PM3", "PM4",
  // Phase 4 — Property information forms
  "VM5", "VM6",
  // Phase 5 — Mortgage (auto-NR'd on cash files)
  "PM5", "PM6", "PM11",
  // Phase 6 — Draft contract pack (BILATERAL)
  "VM7", "PM7",
  // Phase 7 — Management pack (auto-NR'd on freehold files)
  "VM8", "VM9", "PM12",
  // Phase 8 — Searches
  "PM8", "PM13",
  // Phase 9 — Survey
  "PM9", "PM10",
  // Phase 10 — Initial enquiries (BILATERAL)
  "PM14", "VM10", "VM11", "VM12", "PM15", "PM16",
  // Phase 11 — Further enquiries (BILATERAL)
  "PM17", "VM13", "VM14", "VM15", "PM18", "PM19", "PM20",
  // Phase 12 — Final report + contract sign-off
  "PM21", "VM16", "VM17", "PM22", "PM23",
  // Phase 13 — Deposit (auto-NR'd on cash_from_proceeds)
  "PM24",
  // Phase 14 — Ready to exchange (agent-only, existing auto-confirm)
  "VM18", "PM25",
  // Phase 15 — Exchange (agent-only, existing auto-confirm)
  "VM19", "PM26",
  // Phase 16 — Completion (agent-only, existing auto-confirm)
  "VM20", "PM27",
];

// Phase boundaries — used by the snapshot tool to insert phase headings
// in the per-shape journey docs. Each entry is the FIRST code of a new
// phase; phases run until the next entry.
export const PHASE_HEADINGS: Record<string, string> = {
  VM1:  "Phase 1 — Instruction",
  VM2:  "Phase 2 — Memorandum of sale",
  VM3:  "Phase 3 — Welcome pack, ID/AML, money on account",
  VM5:  "Phase 4 — Property information forms",
  PM5:  "Phase 5 — Mortgage",
  VM7:  "Phase 6 — Draft contract pack (bilateral)",
  VM8:  "Phase 7 — Management pack",
  PM8:  "Phase 8 — Searches",
  PM9:  "Phase 9 — Survey",
  PM14: "Phase 10 — Initial enquiries (bilateral)",
  PM17: "Phase 11 — Further enquiries (bilateral)",
  PM21: "Phase 12 — Final report + contract sign-off",
  PM24: "Phase 13 — Deposit",
  VM18: "Phase 14 — Ready to exchange",
  VM19: "Phase 15 — Exchange",
  VM20: "Phase 16 — Completion",
};

// Milestone labels — used by the suppression message in the journey docs
// ("No email — Mortgage application not applicable for cash buyers").
// Mirrors prisma/seed.ts MilestoneDefinition.name verbatim.
export const MILESTONE_LABELS: Record<string, string> = {
  VM1:  "Seller has instructed their solicitor",
  VM2:  "Seller has received the memorandum of sale",
  VM3:  "Seller has received the welcome pack from their solicitor",
  VM4:  "Seller has completed ID and AML checks with their solicitor",
  VM5:  "Seller has received the property information forms from their solicitor",
  VM6:  "Seller has returned completed property information forms to their solicitor",
  VM7:  "Seller's solicitor has issued the draft contract pack",
  VM8:  "Seller's solicitor has requested the management pack",
  VM9:  "Seller's solicitor has received the management pack",
  VM10: "Seller's solicitor has received initial enquiries",
  VM11: "Seller has provided initial replies to their solicitor",
  VM12: "Seller's solicitor has issued initial responses to the buyer's solicitor",
  VM13: "Seller's solicitor has received additional enquiries",
  VM14: "Seller has provided additional replies to their solicitor",
  VM15: "Seller's solicitor has issued additional responses to the buyer's solicitor",
  VM16: "Seller's solicitor has issued contract documents to the seller",
  VM17: "Seller's solicitor has received signed contract documents back from the seller",
  VM18: "Seller's solicitor has confirmed readiness to exchange",
  VM19: "Seller has received confirmation that contracts have exchanged",
  VM20: "Seller has received confirmation that the sale has completed",
  PM1:  "Buyer has instructed their solicitor",
  PM2:  "Buyer has received the memorandum of sale",
  PM3:  "Buyer has completed ID and AML checks with their solicitor",
  PM4:  "Buyer has paid money on account to their solicitor",
  PM5:  "Buyer has submitted their mortgage application",
  PM6:  "Lender valuation has been booked",
  PM7:  "Buyer's solicitor has received the draft contract pack",
  PM8:  "Buyer's solicitor has ordered searches",
  PM9:  "Buyer has booked a Level 2 or Level 3 survey",
  PM10: "Buyer has received the survey report",
  PM11: "Buyer's solicitor has received the mortgage offer",
  PM12: "Buyer's solicitor has received the management pack from the vendor's solicitor",
  PM13: "Buyer's solicitor has received the search results",
  PM14: "Buyer's solicitor has raised initial enquiries to the seller's solicitor",
  PM15: "Buyer's solicitor has received initial replies from the seller's solicitor",
  PM16: "Buyer's solicitor has reviewed the initial replies",
  PM17: "Buyer's solicitor has raised additional enquiries",
  PM18: "Buyer's solicitor has received additional replies",
  PM19: "Buyer's solicitor has reviewed the additional replies",
  PM20: "Buyer's solicitor has confirmed all enquiries are now satisfied",
  PM21: "Buyer has received the final report from their solicitor",
  PM22: "Buyer's solicitor has issued contract documents to the buyer",
  PM23: "Buyer's solicitor has received the signed contract documents back from the buyer",
  PM24: "Buyer has transferred the deposit",
  PM25: "Buyer's solicitor has confirmed readiness to exchange",
  PM26: "Buyer has received confirmation that contracts have exchanged",
  PM27: "Buyer has received confirmation that the sale has completed",
};

// Codes that are bilateral (in the hand-off feature's sense). These need
// per-route × per-direction rendering in the journey docs.
export const BILATERAL_HANDOFF_CODES: ReadonlySet<string> = new Set([
  "VM7",  "PM7",
  "VM10", "PM14",
  "VM12", "PM15",
  "VM13", "PM17",
  "VM15", "PM18",
]);

// Per-pair direction map — given a bilateral code, what's its NATURAL
// first-actor direction. Used by the journey doc to decide which side
// gets the route-varied acted-side ack and which side gets the hand-off
// nudge (default direction). Inverse-direction copies are also rendered
// where relevant.
//
// Source: Artifact 1 directions (signed off).
export const HANDOFF_DEFAULT_ACTOR: Record<string, "vendor" | "purchaser"> = {
  VM7: "vendor",   PM7: "vendor",    // Issue→receive: seller issues first
  VM10: "purchaser", PM14: "purchaser", // Raise→receive: buyer raises first
  VM12: "vendor",  PM15: "vendor",
  VM13: "purchaser", PM17: "purchaser",
  VM15: "vendor",  PM18: "vendor",
};

// Pair partner lookup — given a bilateral code, return its counterpart
// in the (issuer, receiver) pair. Used by the send-path to look up
// whether the counterpart milestone is already complete, which determines
// HandoffDirection at runtime ("default" if firing in natural order,
// "inverse" if the second-actor went first).
//
// Symmetric: BILATERAL_PAIR_OF[X] === Y AND BILATERAL_PAIR_OF[Y] === X
// for every entry. The pairs match BILATERAL_HANDOFF_CODES.
export const BILATERAL_PAIR_OF: Record<string, string> = {
  VM7:  "PM7",  PM7:  "VM7",
  VM10: "PM14", PM14: "VM10",
  VM12: "PM15", PM15: "VM12",
  VM13: "PM17", PM17: "VM13",
  VM15: "PM18", PM18: "VM15",
};

// Codes that are "agent-only confirm" — clients can't trigger them via
// portal (see lib/chase/portal-agent-only-codes.ts). Journey docs note
// this in the suppression-style message because the *client* doesn't
// confirm these — the agent does on their behalf.
export const AGENT_ONLY_CONFIRM_CODES: ReadonlySet<string> = new Set([
  "VM18", "PM25",
  "VM19", "PM26",
  "VM20", "PM27",
]);
