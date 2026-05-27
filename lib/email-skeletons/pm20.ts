// PM20 — Buyer's solicitor has confirmed all enquiries are now
// satisfied.
//
// Unique closing event of the enquiry arc — no Phase 10 mirror. This is
// the milestone that signals "the entire enquiry phase is now closed
// out" on both sides. Genuinely good news for everyone. Voice reflects
// that — direct, warm, no hedging.
//
// Both buyer and seller get this email. Distinct from PM19 (which was
// the buyer-side outcome of the follow-up review) because PM20 is the
// formal "all clear" — the platform's signal that the file moves to
// the final report / contract sign-off stage, on both sides.
//
// No tenure or funding conditioning. The "we're clear" framing is the
// same regardless of how the file got here; pulling in additional
// shape-specific notes would dilute the moment.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM20_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Enquiries are all satisfied — {address}" },
    ],
    heroLabel: [
      { text: "Enquiries closed out" },
    ],
    opening: [
      { text: "Real milestone on your purchase — all enquiries are now satisfied." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has confirmed they're comfortable with the answers and that nothing else is outstanding on the enquiry side. The conveyancing's heaviest stretch — combing through the contract pack, raising and resolving questions — is behind you.",
      },
    ],
    whatNext: [
      {
        text: "The file now moves to the final report stage, where your solicitor pulls together everything they've learned about the property and walks you through it before exchange. The remaining steps from here are real but more procedural: final report, contract sign-off, deposit, exchange.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Enquiries are all satisfied — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's enquiries closed out" },
    ],
    opening: [
      { text: "Real milestone on your sale — the buyer's solicitor has confirmed all enquiries are satisfied." },
    ],
    whatHappened: [
      {
        text: "The buyer's side is now comfortable with the answers they've received. Your side's work on the enquiries is fully complete — no more questions coming back from this round or any future round on this file.",
      },
    ],
    whatNext: [
      {
        text: "The file moves to contract sign-off on both sides. The remaining steps from here are more procedural — final reports, contracts, deposit, exchange — and the file's tempo typically picks up once the enquiries phase is closed.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM20 complete: All enquiries satisfied — {address}" },
    ],
    heroLabel: [
      { text: "PM20 — All enquiries satisfied" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed all enquiries satisfied. File ready for final report and contract sign-off." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
