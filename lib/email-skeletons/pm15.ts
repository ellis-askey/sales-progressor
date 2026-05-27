// PM15 — Buyer's solicitor has received initial replies from the seller's
// solicitor.
//
// Bilateral SECOND-actor in the (VM12, PM15) pair. HANDOFF_DEFAULT_ACTOR
// for both is "vendor" — seller's sol issued first, buyer's sol received
// second (natural order). Mirrors PM7 structurally.
//
//   • Purchaser — acted-side ack. Route-varied. No direction gate;
//     always fires when PM15 is confirmed. SUBSTANTIVE — this is the
//     buyer-side moment where the replies actually land. VM12's
//     purchaser nudge was slim by design; this body carries the weight.
//     But: PM14 already explained what enquiries ARE, so this doesn't
//     re-explain — it focuses on "replies are in, here's what your
//     solicitor does with them now."
//
//   • Vendor — inverse-direction nudge. Fires only when PM15 confirms
//     BEFORE VM12 (direction = inverse, edge case). Slim. In default
//     order, the vendor gets no email at PM15 — VM12's ack already
//     covered them.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM15_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement (substantive) ───────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the replies have arrived — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Replies to your enquiries received by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Replies received" },
    ],

    opening: [
      {
        text: "That's the first round of replies in — the seller's formal replies are now with your solicitor.",
        when: { route: "client_portal" },
      },
      {
        text: "The first round of enquiries is back on your side for review — your solicitor has received the seller's formal replies.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // No enquiry-explainer here — PM14 owns that. This body is the
      // "replies are in your solicitor's hands" beat. Distinct from
      // PM16's "review complete" beat, which follows.
      // Trimmed: ψ3 opening now carries "first round of replies in, now
      // with your solicitor"; whatHappened restated the first half.
      // Reduced to the review-mechanics detail not in the opening.
      {
        text: "Your solicitor will work through them carefully — checking that each answer satisfies the question raised, flagging anything unclear or left open, and identifying anything that needs follow-up.",
      },
    ],

    whatNext: [
      // Slimmed per cross-milestone paired-read: the earlier draft of
      // this paragraph listed the three review outcomes (clean / follow-
      // up / material concern) as a forward-look. PM16 fires a few days
      // to a week later and lists the same three outcomes as the present
      // moment. Reading them in sequence, the buyer would see the same
      // three-outcomes paragraph twice. PM16 owns the outcomes framing;
      // this body just sets the review timeline.
      {
        text: "The review usually takes a few days to a week. Your solicitor will surface anything material once they've worked through it.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: inverse-direction nudge (edge case) ───────────────────────
  vendor: {
    subject: [
      {
        text: "Please confirm your solicitor has issued the replies — {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Replies received by buyer's side", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "Word from the buyer's side: their solicitor has the formal replies. Your solicitor sent them as planned, even if the log on our side hasn't caught up yet.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "When you get a moment, open your portal and tap the highlighted confirm button to mark the replies as issued. Ten seconds; brings our records back in step.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM15 complete: Replies received by buyer's side — {address}" },
    ],
    heroLabel: [
      { text: "PM15 — Initial replies received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed receipt of initial replies from vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
