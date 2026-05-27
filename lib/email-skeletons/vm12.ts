// VM12 — Seller's solicitor has issued initial responses to the buyer's
// solicitor.
//
// Bilateral first-actor in the (VM12, PM15) pair. HANDOFF_DEFAULT_ACTOR
// for both is "vendor" — seller's solicitor issues replies first
// (natural order). Mirrors VM7's first-actor structure inverted only
// in which side is acted-side / opposite-side.
//
//   • Vendor — acted-side ack. Route-varied. No direction gate; always
//     fires when VM12 is confirmed. Owns the "your part of the enquiry
//     round is now finished" framing for the seller — distinct from
//     VM10's "received" beat and VM11's "your input is in" beat.
//
//   • Purchaser — default-direction hand-off NUDGE. Fires only when
//     VM12 confirms FIRST in the pair (direction = default). SLIM per
//     the bilateral paired-read rule: opening + CTA + a short flag.
//     PM15's acted-side ack carries the substantive "replies are in your
//     solicitor's hands, review begins" content.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM12_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement ────────────────────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed the replies have gone out — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Replies to enquiries issued by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Replies issued" },
    ],

    opening: [
      {
        text: "The formal replies are out — confirmed by you on the file, your solicitor has sent them to the buyer's side.",
        when: { route: "client_portal" },
      },
      {
        text: "Your active part of the enquiry response is done on your side — your solicitor has issued the formal replies to the buyer's side.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Distinct beat: this is the "your part of the enquiry round is
      // done" moment. VM10 was "received", VM11 was "your input is in
      // with your solicitor", this is "everything is now with the
      // buyer's side."
      // Trimmed: both ψ4 client_portal opening and ω3 agent opening
      // now carry "replies sent to buyer's side" + "active part done";
      // whatHappened restated both. Dropped to a single sentence adding
      // the held-in-escrow detail not in the openings.
      {
        text: "The first round of enquiry handling is now in the buyer's solicitor's hands.",
      },
    ],

    whatNext: [
      // Honest framing — replies may produce follow-up enquiries, may
      // not. PM16 (buyer's solicitor reviewed) is where outcomes will
      // start to surface.
      {
        text: "The buyer's solicitor will review the replies over the next few days to a week. If your answers satisfy them, the file moves on to the next stage. If anything's left open, they'll come back with follow-up enquiries — your solicitor will handle those if they do, and may come to you again on points that need fresh input. Your solicitor will surface where the review lands once it's complete.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: default-direction hand-off nudge (SLIM) ────────────────
  purchaser: {
    subject: [
      {
        text: "Replies to your enquiries are on their way — {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Replies in transit", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "The seller's solicitor has issued the formal replies to your initial enquiries — they're on their way to your solicitor now.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know they've landed, open your portal and tap the highlighted confirm button — that logs receipt and triggers the review step. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM12 complete: Replies issued — {address}" },
    ],
    heroLabel: [
      { text: "VM12 — Initial replies issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed issue of formal replies to initial enquiries." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
