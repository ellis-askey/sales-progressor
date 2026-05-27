// VM18 — Seller's solicitor has confirmed readiness to exchange.
//
// Agent-only confirm (per AGENT_ONLY_CONFIRM_CODES). Clients can't
// trigger via portal — the agent or Sales Progressor logs it after the
// solicitor confirms. So no "you've confirmed" framing; event-narrated
// openings only.
//
// Phase 14 (VM18, PM25) fires emails to BOTH sides — readiness moments
// are asymmetric in time (each side's solicitor confirms independently,
// sometimes hours, sometimes a day or two apart) and the counterpart
// benefits from knowing where they are. Phase 15 + 16 (VM19/PM26,
// VM20/PM27) fire only to the primary side because exchange and
// completion are singular legal events and cross-side firing would
// just duplicate the same notification.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM18_SKELETON: MilestoneSkeleton = {

  vendor: {
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
        text: "Everything on your side is in place: contracts signed and held in escrow, conveyancing complete, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the buyer's side is also there.",
      },
    ],
    whatNext: [
      {
        text: "Exchange happens when both solicitors are ready and agree the moment. If the buyer's side is also there, exchange is imminent; if they're not yet, it follows as soon as they confirm. Either way, the next time you hear from us, exchange will have happened — and that's the legal commitment moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's side is ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "Seller's side ready" },
    ],
    opening: [
      { text: "The seller's side has confirmed they're ready to exchange." },
    ],
    whatHappened: [
      // Order-agnostic phrasing — VM18 and PM25 can fire in either
      // order, so this body avoids predicting which side confirms next.
      // Earlier draft said "exchange will happen the moment your side
      // confirms the same" which was wrong if PM25 had already fired.
      {
        text: "The seller's solicitor has formally confirmed everything on their side is in place. Once both sides have formally confirmed, exchange follows — it's a procedural decision between the two solicitors at that point.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM18 complete: Seller's side ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "VM18 — Seller ready to exchange" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed readiness to exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
