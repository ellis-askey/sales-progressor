// PM26 — Buyer has received confirmation that contracts have exchanged.
//
// Agent-only confirm. Purchaser-only — no vendor body (VM19 handles
// the seller's notification of the same legal event). Tone: real
// transformative moment for the buyer — they are now legally
// committed to buying this property, with the contractual right to
// completion on the agreed date. Earn it.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM26_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Contracts have exchanged — your purchase is now legally binding — {address}" },
    ],
    heroLabel: [
      { text: "Exchanged" },
    ],
    opening: [
      { text: "Exchange has happened — your purchase is now legally binding." },
    ],
    whatHappened: [
      {
        text: "The two solicitors have formally exchanged contracts. Your deposit has transferred across to the seller's side, and the agreed completion date is locked in. You're now contractually entitled to buy the property on that date, and the seller is contractually obliged to sell.",
      },
    ],
    whatNext: [
      {
        text: "The next big moment is completion — when the balance funds transfer to the seller, ownership formally becomes yours, and the keys are handed over. Your solicitor will be in touch about the final balance transfer (and, if you're on a mortgage, the mortgage advance comes in at this point too). Closer to the date, look out for the next email — practical completion-day specifics: timing on the day, where to collect keys, what to do about utilities.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor body — VM19 handles the seller's exchange notification.

  progressor: {
    subject: [
      { text: "PM26 complete: Exchange confirmed on buyer's side — {address}" },
    ],
    heroLabel: [
      { text: "PM26 — Exchange (buyer's side)" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has received confirmation of exchange of contracts. Sale legally binding; completion date locked in." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
