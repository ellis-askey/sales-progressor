// VM15 — Seller's solicitor has issued additional replies to the buyer's
// solicitor.
//
// Bilateral first-actor in the (VM15, PM18) pair. Mirror of VM12 for
// the follow-up round. Substantive seller-side ack + slim default-
// direction nudge to buyer. The vendor whatNext here has a distinct
// beat from VM12's: this round either closes things out (likely) or
// triggers a rare third round (unusual at this stage). VM12 framed
// "first round done, second round possible"; this body frames "second
// round done, third round unusual."

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM15_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side ack ────────────────────────────────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed the follow-up replies have gone out — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Follow-up replies issued by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies issued" },
    ],

    opening: [
      {
        text: "You've just confirmed the follow-up replies are out — your solicitor's sent them across to the buyer's side.",
        when: { route: "client_portal" },
      },
      {
        text: "Follow-up replies issued — your solicitor has sent them across to the buyer's side, which leaves the file in the buyer's-side-review window.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Trimmed: both ψ2 client_portal opening and ω4 agent opening
      // now carry "replies sent to buyer's side" + the meaning beat.
      // Reduced to a single sentence naming the closure of the enquiry
      // work on the seller's side as the lasting status.
      {
        text: "The enquiry phase on your side of the file is now wrapped up.",
      },
    ],

    whatNext: [
      {
        text: "The buyer's solicitor will review the replies over the next few days. In the great majority of files, this closes the enquiry phase out and the file moves on to the final report and contract sign-off. A rare third round is possible if something specific is still open, but at this stage it's unusual — your solicitor will handle it if it does come up.",
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
        text: "Follow-up replies on the way to your solicitor — {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies in transit", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "Follow-up replies are on their way to your solicitor.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know they've landed, open your portal and tap the highlighted confirm button. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM15 complete: Follow-up replies issued — {address}" },
    ],
    heroLabel: [
      { text: "VM15 — Follow-up replies issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed issue of formal follow-up replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
