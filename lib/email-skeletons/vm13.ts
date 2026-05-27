// VM13 — Seller's solicitor has received additional enquiries.
//
// Bilateral second-actor in the (PM17, VM13) pair. Mirror of VM10 for
// the follow-up round. NO enquiry-explainer here (VM10 owned it for the
// whole seller-side enquiry arc). Distinct beat: this round is shorter
// and more focused, and the seller's solicitor has the muscle memory
// from round 1.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM13_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side ack ────────────────────────────────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed the follow-up enquiries have landed — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Buyer's follow-up enquiries received by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Follow-up enquiries received" },
    ],

    opening: [
      {
        text: "Thanks — your solicitor's now got the follow-up enquiries from the buyer's side.",
        when: { route: "client_portal" },
      },
      {
        text: "The follow-up enquiries are now with your solicitor, raised by the buyer's solicitor today.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      {
        text: "These are the buyer's solicitor's follow-up questions after working through the initial replies — typically a shorter list focused on specific points the first round didn't fully close out.",
      },
    ],

    whatNext: [
      {
        text: "Your solicitor will work through them and come to you if any need fresh input. Turnaround on follow-up rounds is usually faster than the initial enquiries — fewer points, more focused — so this should move more quickly.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: inverse-direction nudge (edge case) ────────────────────
  purchaser: {
    subject: [
      {
        text: "Please confirm your solicitor has raised the follow-up enquiries — {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Follow-up enquiries received by seller's side", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The seller's solicitor has the follow-up enquiries in hand — your solicitor raised them as planned, but the matching log on our side hasn't come through yet.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "Hop into your portal and tap the highlighted confirm button — it'll take ten seconds and brings the record up to date.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM13 complete: Additional enquiries received — {address}" },
    ],
    heroLabel: [
      { text: "VM13 — Additional enquiries received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed receipt of additional enquiries from purchaser solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
