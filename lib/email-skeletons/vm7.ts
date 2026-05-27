// VM7 — Seller's solicitor has issued the draft contract pack.
//
// First FULL bilateral authored after the PM7 spike. VM7 is the NATURAL
// first actor in the (VM7, PM7) pair (HANDOFF_DEFAULT_ACTOR.VM7 = vendor),
// so the directional logic mirrors PM7 inverted:
//
//   • Vendor — acted-side acknowledgement. Fires on every VM7 confirmation
//     regardless of direction (the seller just confirmed; they always get
//     their ack). Varied by route × tenure. No funding conditioning on the
//     seller side at this stage — the funding shape matters to the buyer.
//
//   • Purchaser — default-direction hand-off NUDGE. Fires only when VM7
//     confirms FIRST in the pair (direction = default). Deliberately
//     SLIM — opening + CTA + a short leasehold-only note. The pack
//     composition explainer, the buyer's next-steps detail, and the
//     funding-tail content all live in PM7's acted-side ack, NOT here.
//
//     Why: this nudge fires immediately before PM7's ack on the same
//     reader in default-direction journeys. If both bodies carried the
//     substantive content, the buyer would receive the pack composition
//     and the funding tail twice in close sequence — exactly the noise
//     the hand-off feature exists to prevent. VM7's job per Artifact 2
//     is a baton-pass nudge: tell the buyer the pack is en route, point
//     them at the highlighted confirm button, get out of the way.
//     PM7's ack carries the substance once the baton actually lands.
//
//     Suppressed on direction = inverse (PM7 already fired its acted-
//     side ack to the buyer first, so a nudge would be backward).
//
// All four condition keys still exercised across the skeleton: tenure
// (leasehold add-ons on vendor; short leasehold note on purchaser),
// purchaseType (no longer conditions the purchaser nudge — funding tail
// belongs in PM7), route (three confirmer paths on the vendor ack),
// direction (gates the purchaser nudge to default-only).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM7_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement ────────────────────────────────
  //
  // Always fires when VM7 confirms. Route-varied opening (first-person
  // client_portal vs third-person agent/SP). Tenure add-ons describe the
  // pack contents on leasehold (additional leasehold-specific bundle in
  // the same pack) and flag the management pack as a separate moving
  // piece in whatNext.
  vendor: {
    subject: [
      {
        text: "You've confirmed the contract pack has gone out — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Contract pack issued to the buyer's side — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Contract pack issued" },
    ],

    opening: [
      {
        text: "Thanks — your solicitor's sent the draft contract pack across to the buyer's solicitor.",
        when: { route: "client_portal" },
      },
      {
        text: "The draft contract pack has gone across to the buyer's solicitor — your solicitor issued it today.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Universal — what's in the pack and why it matters.
      {
        text: "The draft contract pack is the bundle of documents your solicitor sends across as the legal foundation of the sale — the draft contract itself, the title documents, the property information forms you completed (TA6 and TA10), and any relevant certificates or guarantees.",
      },
      // Leasehold addendum — TA7 inclusion + management pack note.
      {
        text: "The TA7 leasehold information form is in the pack alongside TA6 and TA10. The management pack from your freeholder is the one remaining piece that travels separately — if it's already back, your solicitor will have folded it in; if not, it'll follow on its own clock.",
        when: { tenure: "leasehold" },
      },
    ],

    whatNext: [
      // Universal — buyer's solicitor reviews; enquiries follow.
      {
        text: "The buyer's solicitor will now review the pack carefully and, typically over the next week or two, raise enquiries about anything they want clarified. Your solicitor will handle those — expect them to come to you on any specific point that needs your read.",
      },
      // Leasehold addendum — management pack as the chase point.
      {
        text: "If the management pack from your freeholder hasn't arrived yet, that's the piece worth chasing yourself — the buyer's enquiries will be held up if it's still outstanding when they want to review the leasehold detail.",
        when: { tenure: "leasehold" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: default-direction hand-off nudge (SLIM) ────────────────
  //
  // Per Ellis batch-3 (A) call: a baton-pass nudge, not a status update.
  // Three logical pieces only:
  //   1. Opening — the pack has been issued, it's en route
  //   2. CTA (in whatHappened) — highlighted confirm button + what it
  //      does. Universal. No pack composition explainer.
  //   3. Leasehold-only short note (in whatNext) — one sentence flagging
  //      the management pack as a separate piece on its own clock. Short
  //      version; the fuller leasehold explainer lives in PM7's ack.
  //
  // Densest shape (leasehold) renders at 3 paragraphs. Freehold renders
  // at 2. The funding tail and the pack composition both live in PM7
  // and fire once, on receipt — not here.
  purchaser: {
    subject: [
      {
        text: "The contract pack is on its way to your solicitor — {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Contract pack in transit", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "Draft contract pack on its way to your solicitor — issued by the seller's side today.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      // Universal CTA — the whole point of this email. The highlighted
      // confirm button is the baton-pass; the next-step framing tells
      // the reader why ten seconds of action matters.
      {
        text: "When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button — that logs it on the file and triggers the next steps. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    whatNext: [
      // Leasehold-only short flag — one sentence. Short version on
      // purpose. PM7's ack carries the fuller leasehold framing
      // (management pack on the seller's side, folding into enquiries).
      {
        text: "The management pack from the freeholder is a separate piece on its own clock — your solicitor will flag it when it lands.",
        when: { direction: "default", tenure: "leasehold" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  // ── Progressor: internal log (shape-stable, single body) ──────────────
  progressor: {
    subject: [
      { text: "VM7 complete: Contract pack issued — {address}" },
    ],
    heroLabel: [
      { text: "VM7 — Draft contract pack issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed issue of draft contract pack to buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
