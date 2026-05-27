// PM14 — Buyer's solicitor has raised initial enquiries to the seller's
// solicitor.
//
// Bilateral first-actor in the (PM14, VM10) pair. HANDOFF_DEFAULT_ACTOR
// for both is "purchaser" — the buyer's side raises enquiries first
// (natural order). Directional logic:
//
//   • Purchaser — acted-side ack. Route-varied (3 routes × tenure ×
//     funding). No direction gate; always fires when PM14 is confirmed.
//     This body owns the "what enquiries are" explainer for the buyer's
//     side of the whole Phase 10 arc — PM15 (replies received) and
//     PM16 (review complete) refer to "the enquiries" without re-
//     explaining what they are.
//
//   • Vendor — default-direction hand-off NUDGE. Fires only when PM14
//     confirms FIRST in the pair (direction = default). Deliberately
//     SLIM per the bilateral paired-read rule: opening + CTA + a short
//     leasehold-only flag. The substantive "what to expect from
//     enquiries" content lives in VM10's acted-side ack (which fires
//     when the seller's side confirms receipt), not here.
//
// Tenure conditioning: leasehold gets an addendum on the buyer side
// (leasehold sales typically generate longer enquiry lists because the
// management pack and lease-specific points need to be combed through),
// and a short flag on the vendor nudge.
//
// No funding conditioning on PM14 — the enquiry-process delay vs.
// mortgage-offer-window concern is real but PM16 is the natural place
// for it (when the review is complete and timing implications become
// concrete), not at the moment enquiries are raised.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM14_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement ─────────────────────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed your solicitor has raised the enquiries — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Initial enquiries raised on your purchase — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Initial enquiries raised" },
    ],

    opening: [
      {
        text: "You've just confirmed the initial enquiries are with the seller's side — raised by your solicitor today.",
        when: { route: "client_portal" },
      },
      {
        text: "Initial enquiries raised — your solicitor has sent them across to the seller's side, kicking off the question-and-response phase.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Universal — explains what enquiries are. PM15 + PM16 refer to
      // "the enquiries" / "the replies" without re-explaining this.
      {
        text: "Enquiries are the formal questions your solicitor raises after reading through the contract pack — clarifications about title, planning matters, what's included in the sale, anything in the property forms that needs more detail. They're how the buyer's side gets comfortable with the legal and practical side of what you're buying.",
      },
      // Leasehold addendum — distinct beat (leasehold-specific scope).
      {
        text: "There's also a leasehold scope to factor in — the enquiry list tends to run longer because the lease itself, the service charges, the freeholder relationship, and the management pack detail all need combing through. That's normal — not a sign anything's wrong — and it's the work that protects you from inheriting issues you didn't know about.",
        when: { tenure: "leasehold" },
      },
    ],

    whatNext: [
      {
        text: "The seller's solicitor will receive the enquiries and work through them with the seller — typical turnaround is 1–4 weeks, though more complex points can take longer. This is back-of-house work from your side; the file moves on its own clock now.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: default-direction hand-off nudge (SLIM) ───────────────────
  //
  // Fires only on direction = default (PM14 confirmed first in the pair).
  // Per the bilateral paired-read rule: opening + CTA + minimal flag.
  // VM10's acted-side ack carries the substantive "what enquiries are
  // and what to expect" content; this is a baton-pass.
  vendor: {
    subject: [
      {
        text: "Enquiries raised on your sale — please confirm receipt — {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Enquiries raised by buyer's side", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "Initial enquiries en route to your solicitor — raised today by the buyer's side.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know they've landed, open your portal and tap the highlighted confirm button — that logs receipt and keeps the file in sync. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    whatNext: [
      // Short leasehold flag — the longer "leasehold enquiries are
      // bigger" framing lives in PM14 purchaser and VM10 vendor; here
      // it's just a one-sentence heads-up.
      {
        text: "Worth flagging on the leasehold side: enquiry lists usually run longer than on a freehold. Your solicitor will let you know what (if anything) they need from you.",
        when: { direction: "default", tenure: "leasehold" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM14 complete: Initial enquiries raised — {address}" },
    ],
    heroLabel: [
      { text: "PM14 — Initial enquiries raised" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed initial enquiries raised with vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
