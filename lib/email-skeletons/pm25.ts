// PM25 — Buyer's solicitor has confirmed readiness to exchange.
//
// Agent-only confirm. Mirror of VM18 on the buyer side. Both sides
// fire because the readiness moments are asymmetric in time.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM25_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor is ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "Ready to exchange" },
    ],
    opening: [
      { text: "Your solicitor has confirmed they're ready to exchange." },
    ],
    whatHappened: [
      {
        text: "Everything on your side is in place: contracts signed and held in escrow, deposit transferred, conveyancing complete, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the seller's side is also there.",
      },
    ],
    whatNext: [
      {
        text: "Exchange happens when both solicitors are ready and agree the moment. If the seller's side is also there, exchange is imminent; if they're not yet, it follows as soon as they confirm. The next time you hear from us, exchange will have happened — and that's the legal commitment moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's side is ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's side ready" },
    ],
    opening: [
      { text: "The buyer's side has confirmed they're ready to exchange." },
    ],
    whatHappened: [
      // Order-agnostic phrasing — VM18 and PM25 can fire in either
      // order, so this body avoids predicting which side confirms next.
      // Earlier draft said "exchange will happen the moment your side
      // confirms the same" which was wrong if VM18 had already fired.
      {
        text: "The buyer's solicitor has formally confirmed everything on their side is in place — contracts signed, deposit transferred, conveyancing complete. Once both sides have formally confirmed, exchange follows.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM25 complete: Buyer's side ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "PM25 — Buyer ready to exchange" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed readiness to exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
