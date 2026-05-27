// PM22 — Buyer's solicitor has issued contract documents to the buyer.
//
// Universal across shape. Substantive beat for the buyer (here are the
// documents to sign). Mirror of VM16 on the buyer side. The buyer's
// signing moment lands AFTER they've read the final report (PM21), so
// the distinctive framing here is "you've done the thinking; this is
// execution." Don't re-explain what contracts are — that's clear from
// the milestone itself.
//
// Vendor body brief — VM16 vendor was the seller's own signing moment;
// PM22 vendor body is the heads-up that the buyer is now at their
// signing stage. Distinct from VM16 vendor by audience perspective.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM22_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Contracts ready for your signature — {address}" },
    ],
    heroLabel: [
      { text: "Contracts to sign" },
    ],
    opening: [
      { text: "Your contracts are ready for signing." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has issued the contract pack — the final draft contract, the transfer deed, and any other documents needing your signature. You've already done the thinking through the final report; this step is execution.",
      },
    ],
    whatNext: [
      {
        text: "Read through everything before signing — your solicitor will have walked you through anything notable, but check the price, the names, the property address, and any agreed inclusions/exclusions look right. Sign and return promptly; your solicitor will hold the signed contracts and start coordinating exchange timing with the seller's side. Your solicitor will also be in touch separately about the deposit transfer — that's the next active step on your side.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer is signing the contracts — {address}" },
    ],
    heroLabel: [
      { text: "Buyer signing" },
    ],
    opening: [
      { text: "Buyer's side is at signing stage." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has sent the contract documents to the buyer for signing. Once they sign and return, the two solicitors can start agreeing an exchange moment.",
      },
    ],
    // No whatNext — held brief, parallel to VM16 purchaser's structure.
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM22 complete: Contracts issued to buyer — {address}" },
    ],
    heroLabel: [
      { text: "PM22 — Contracts issued to buyer" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed issue of contract documents to purchaser for signing." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
