// PM11 — Buyer's solicitor has received the mortgage offer.
//
// Mortgage-only milestone (auto-NR'd on cash files). Significant moment:
// the mortgage offer landing with the solicitor is one of the last
// remaining buyer-side blockers before exchange becomes possible. Shape-
// stable across tenure — the mortgage offer process doesn't differ by
// freehold/leasehold from the receipt moment. Universal copy throughout.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM11_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Mortgage offer received by your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Mortgage offer in" },
    ],
    opening: [
      { text: "Big milestone — your mortgage offer is with your solicitor." },
    ],
    whatHappened: [
      {
        text: "Your formal mortgage offer has been received by your solicitor. This is a significant step — the lender has committed to funding your purchase on the terms set out in the offer.",
      },
    ],
    whatNext: [
      {
        text: "Your solicitor will review the offer's conditions, check it against the property and your purchase, and incorporate it into the contract pack and final report. There's nothing to do from your side right now unless your solicitor raises a query about a specific condition.",
      },
      {
        text: "Read your mortgage offer yourself when you get a copy. The conditions are binding — if there's anything you don't understand or that doesn't match what you expected (the loan amount, the rate, the term, any special conditions), flag it with your broker or solicitor now rather than later.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's mortgage offer is in — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's mortgage offer in" },
    ],
    opening: [
      { text: "The buyer's mortgage offer has landed." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has received the formal mortgage offer from the lender. That's one of the last remaining buyer-side blockers to exchange — funding is now committed.",
      },
    ],
    whatNext: [
      {
        text: "With the offer in place, the remaining steps are largely the conveyancing pieces — enquiries, searches, and the final contract sign-off. Exchange becomes a realistic prospect once those land.",
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
      { text: "Buyer's solicitor has confirmed receipt of formal mortgage offer." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
