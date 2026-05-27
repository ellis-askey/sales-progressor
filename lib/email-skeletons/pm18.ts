// PM18 — Buyer's solicitor has received additional replies.
//
// Bilateral second-actor in the (VM15, PM18) pair. Mirror of PM15 for
// the follow-up round. No enquiry-explainer; no review-mechanism re-
// statement (PM15 + PM16 already covered the review machinery for the
// buyer earlier in the arc). This body's beat is the receipt moment;
// PM19 owns "review complete" outcomes.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM18_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side ack ─────────────────────────────────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the follow-up replies have arrived — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Follow-up replies received by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies received" },
    ],

    opening: [
      {
        text: "The follow-up replies are back — you've just flagged them as received, your solicitor now has them.",
        when: { route: "client_portal" },
      },
      {
        text: "The seller's follow-up replies have landed with your solicitor — issued from the seller's side today.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Trimmed: ψ4 opening now carries "replies back, your solicitor
      // has them"; whatHappened restated the first half. Reduced to
      // the faster-review-than-initial detail not in the opening.
      {
        text: "Your solicitor will work through them and let you know what they conclude — typically faster than the initial review since there are fewer points to consider.",
      },
    ],

    // No whatNext — the receipt body is intentionally tight. PM19 will
    // cover review outcomes when it fires.

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: inverse-direction nudge (edge case) ───────────────────────
  vendor: {
    subject: [
      {
        text: "Please confirm your solicitor has issued the follow-up replies — {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies received by buyer's side", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "On the buyer's side, the follow-up replies are logged as received — your solicitor sent them as planned, but the confirmation hasn't reached us yet.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "Quick favour — open your portal and confirm the follow-up replies have been issued. The highlighted button is sitting there waiting; ten seconds and the record's in step.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM18 complete: Follow-up replies received — {address}" },
    ],
    heroLabel: [
      { text: "PM18 — Follow-up replies received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed receipt of follow-up replies from vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
