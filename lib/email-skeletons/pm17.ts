// PM17 — Buyer's solicitor has raised additional enquiries.
//
// Bilateral first-actor in the (PM17, VM13) pair. Mirror of PM14's
// structure but for the follow-up round, NOT the discovery round.
//
// Cross-Phase discipline: Phase 10 (PM14/VM10/VM11/VM12/PM15/PM16)
// authored the "what enquiries are, how the process works" full
// explainer. Phase 11 starts here with no enquiry-explainer at all —
// the reader already knows what enquiries are. This body's distinct
// beat is "this round is the focused follow-up, usually shorter and
// faster" — which is what would actually feel different to a real
// reader hitting PM17 a few weeks after PM16.
//
// No tenure conditioning. The leasehold-volume scope flagged in
// Phase 10 was a one-time framing about the initial round size; it
// doesn't apply to follow-ups, which are about whatever specific
// points were left open from round 1 (could be leasehold, could not).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM17_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side ack (route-varied, substantive) ─────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the follow-up enquiries have gone out — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Additional enquiries raised on your purchase — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Additional enquiries raised" },
    ],

    opening: [
      {
        text: "The additional enquiries are out — your confirmation's in, and your solicitor has raised them with the seller's side.",
        when: { route: "client_portal" },
      },
      {
        text: "Logged on your purchase: your solicitor has raised the additional enquiries with the seller's side.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      {
        text: "After reviewing the initial replies, your solicitor flagged specific points that needed more follow-up — these are the focused questions tightening up anything the first round didn't fully close out. Typically a shorter, more specific list than the initial enquiries.",
      },
    ],

    whatNext: [
      {
        text: "Turnaround on follow-up enquiries is usually faster than the initial round — 1–3 weeks is typical — because the seller's side has done the heavy lifting and these are more targeted.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: default-direction hand-off nudge (SLIM) ───────────────────
  vendor: {
    subject: [
      {
        text: "Follow-up enquiries on the way — please confirm receipt — {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Additional enquiries raised", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "Round 2 of enquiries inbound — the buyer's solicitor has raised them today, heading to your solicitor.",
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
      { text: "PM17 complete: Additional enquiries raised — {address}" },
    ],
    heroLabel: [
      { text: "PM17 — Additional enquiries raised" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed additional enquiries raised." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
