// VM18 — Seller's solicitor has confirmed readiness to exchange.
//
// Agent-only confirm. Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM18_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Your solicitor is ready to exchange, {address}" },
    ],
    heroLabel: [
      { text: "Ready to exchange" },
    ],
    opening: [
      { text: "Your solicitor has confirmed they're ready to exchange." },
    ],
    whatHappened: [
      {
        text: "Everything on your side is in place: contracts signed and held in readiness, conveyancing complete, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the buyer's side is also there.",
      },
    ],
    whatNext: [
      {
        text: "Exchange happens when both solicitors are ready and agree the moment. If the buyer's side is also there, exchange is imminent. If they're not yet, it follows as soon as they confirm. Either way, the next time you hear from us, exchange will have happened, and that's the legal commitment moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's side is ready to exchange, {address}" },
    ],
    heroLabel: [
      { text: "Seller ready to exchange" },
    ],
    opening: [
      { text: "The seller's solicitor has formally confirmed everything on their side is in place." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Once both sides have formally confirmed, exchange follows. It's a procedural decision between the two solicitors at that point.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM18 complete: Seller ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "VM18 — Seller ready to exchange" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed readiness to exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
