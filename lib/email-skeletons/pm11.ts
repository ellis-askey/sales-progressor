// PM11 — Buyer's solicitor has received the mortgage offer.
//
// Mortgage-only milestone (auto-NR'd on cash files in lib/milestone-auto-nr.ts).
// One of the last remaining buyer-side blockers before exchange.
//
// Tenure deltas: leasehold variant adds "the leasehold review" to the
// vendor's remaining-steps list, and adds a sentence about lender lease
// conditions to the purchaser's reading-the-offer paragraph.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM11_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's mortgage offer is in, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's mortgage offer received" },
    ],
    opening: [
      { text: "The buyer's mortgage offer has landed." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has received the formal mortgage offer from the lender. That clears one of the last remaining buyer-side blockers to exchange. Their funding is now committed.",
      },
    ],
    whatNext: [
      // Freehold version.
      {
        text: "With the offer in place, the remaining steps are largely the conveyancing pieces: enquiries, searches, and the final contract sign-off. Exchange becomes a realistic prospect once those land.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds "the leasehold review".
      {
        text: "With the offer in place, the remaining steps are largely the conveyancing pieces: enquiries, searches, the leasehold review, and the final contract sign-off. Exchange becomes a realistic prospect once those land.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Mortgage offer received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Mortgage offer received" },
    ],
    opening: [
      { text: "Your mortgage offer is with your solicitor." },
    ],
    whatHappened: [
      {
        text: "This is a significant step. The lender has committed to funding your purchase on the terms set out in the offer. Your solicitor will review the offer's conditions, check them against the property and your purchase, and fold the offer into the contract pack and final report. Nothing to do from your side right now unless your solicitor raises a query about a specific condition.",
      },
    ],
    whatNext: [
      // Freehold version.
      {
        text: "Read your mortgage offer yourself when you get a copy. The conditions are binding. If anything doesn't match what you expected, the loan amount, the rate, the term, or any special conditions, flag it with your broker or solicitor now rather than later.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds lender lease conditions sentence.
      {
        text: "Read your mortgage offer yourself when you get a copy. The conditions are binding. If anything doesn't match what you expected, the loan amount, the rate, the term, or any special conditions, flag it with your broker or solicitor now rather than later. On a leasehold purchase, lenders sometimes attach conditions about the lease (a minimum number of years remaining, or ground rent terms), so check for anything of that kind in particular.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM11 complete: Mortgage offer received — {address}" },
    ],
    heroLabel: [
      { text: "PM11 — Mortgage offer received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of the formal mortgage offer." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
