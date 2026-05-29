// PM20 — Buyer's solicitor has confirmed all enquiries are now satisfied.
//
// Non-bilateral closing event of the enquiry arc. Vendor + purchaser.
// Tenure delta on the purchaser whatHappened paragraph: leasehold variant
// adds "the management pack" to the work-recap list.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM20_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Enquiries are all satisfied, {address}" },
    ],
    heroLabel: [
      { text: "Enquiries satisfied" },
    ],
    opening: [
      { text: "A real moment on your sale. The buyer's solicitor has confirmed all enquiries are satisfied." },
    ],
    whatHappened: [
      {
        text: "The buyer's side is now comfortable with the answers they've received. Your side's work on the enquiries is fully complete. No more questions coming back from this round or any future round on this file.",
      },
    ],
    whatNext: [
      {
        text: "The file moves to contract sign-off on both sides. The remaining steps are more procedural: final reports, contracts, deposit, exchange. The pace typically picks up once the enquiries phase is closed.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Enquiries are all satisfied, {address}" },
    ],
    heroLabel: [
      { text: "Enquiries satisfied" },
    ],
    opening: [
      { text: "A real moment on your purchase. All enquiries are now satisfied." },
    ],
    whatHappened: [
      // Freehold version — work-recap doesn't mention management pack.
      {
        text: "Your solicitor has confirmed they're comfortable with the answers and that nothing else is outstanding on the enquiry side. The heaviest stretch of conveyancing, combing through the contract pack and raising and resolving questions, is behind you.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds "the management pack" to the recap.
      {
        text: "Your solicitor has confirmed they're comfortable with the answers and that nothing else is outstanding on the enquiry side. The heaviest stretch of conveyancing, combing through the contract pack, raising and resolving questions, the management pack, is behind you.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      {
        text: "The file now moves to the final report stage, where your solicitor pulls together everything they've learned about the property and walks you through it before exchange. The remaining steps are real but procedural: final report, contract sign-off, deposit, exchange.",
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
      { text: "PM20 — Enquiries satisfied" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed all enquiries on the file are satisfied." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
