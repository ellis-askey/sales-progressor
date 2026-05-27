// VM10 — Seller's solicitor has received initial enquiries.
//
// Bilateral SECOND-actor in the (PM14, VM10) pair. HANDOFF_DEFAULT_ACTOR
// for both is "purchaser" — buyer raised first, seller received second
// (natural order). Directional logic:
//
//   • Vendor — acted-side ack. Route-varied. No direction gate; always
//     fires when VM10 is confirmed. This is the substantive "what the
//     enquiry process looks like from your side" moment for the seller —
//     PM14's vendor nudge was just the baton-pass, and this body owns
//     the explainer of how enquiries work and what input the seller may
//     be asked for.
//
//   • Purchaser — inverse-direction hand-off nudge. Fires only when
//     VM10 confirms BEFORE PM14 (direction = inverse, edge case). Slim.
//     If VM10 fires in default order (PM14 already happened), the buyer
//     gets no email here — PM14's ack already covered them.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM10_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement (substantive) ──────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed your solicitor has the enquiries — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "Buyer's enquiries received by your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Enquiries received" },
    ],

    opening: [
      {
        text: "You've just confirmed the initial enquiries are with your solicitor — landed from the buyer's side.",
        when: { route: "client_portal" },
      },
      {
        text: "Logged on your sale: your solicitor has received the initial enquiries from the buyer's solicitor.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Universal — explains what enquiries are FROM THE SELLER'S
      // perspective. PM14's purchaser body explains them from the
      // buyer's perspective; this is the seller-facing equivalent and
      // doesn't duplicate the buyer-side framing.
      {
        text: "Enquiries are the formal questions the buyer's solicitor raises after reading the contract pack — clarifications about title, planning, what's included in the sale, anything in the property forms that needs more detail. They're a normal part of every conveyancing process, not a sign anything's wrong.",
      },
      // Leasehold addendum on the volume expectation.
      {
        text: "There's the leasehold scope on top too — even smooth leasehold sales generate sizeable enquiry lists because the lease, the service charges, the freeholder relationship, and the management pack detail all need to be worked through.",
        when: { tenure: "leasehold" },
      },
    ],

    whatNext: [
      // Universal — what to expect, when seller's input is likely.
      {
        text: "Your solicitor will work through the list and draft replies. They'll come to you for input on points only you can answer — details about works you've had done, neighbour relationships, planning consents you've used, anything where the property's history matters. Try to respond promptly when they reach out; the file moves at the speed of these answers.",
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: inverse-direction nudge (edge case) ────────────────────
  //
  // Only fires when VM10 confirms BEFORE PM14 — the seller's side logged
  // receipt of enquiries before the buyer's side logged raising them.
  // Slim — opening + CTA — same shape as the VM7 vendor inverse nudge.
  purchaser: {
    subject: [
      {
        text: "Please confirm your solicitor has raised the enquiries — {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Enquiries received by seller's side", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "Seller's side reports they have the initial enquiries — your solicitor raised them as planned, even if our log hasn't caught up yet.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "Could you spare ten seconds? Open your portal and confirm the enquiries have been raised — the highlighted button is ready, and that brings the record in step.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM10 complete: Enquiries received by seller's side — {address}" },
    ],
    heroLabel: [
      { text: "VM10 — Initial enquiries received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed receipt of initial enquiries from purchaser solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
