// VM20 — Seller has received confirmation that the sale has completed.
//
// Agent-only confirm. Vendor-only — no purchaser body (PM27 handles
// the buyer's completion notification). This is the final milestone
// of the seller's journey: the sale is finalised, funds have been
// received, ownership has transferred. Closure with genuine warmth,
// not a generic "transaction complete" notification.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM20_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Completion — your sale is done — {address}" },
    ],
    heroLabel: [
      { text: "Completed" },
    ],
    opening: [
      { text: "Completion has happened. Your sale is done." },
    ],
    whatHappened: [
      {
        text: "The balance funds have transferred to your solicitor, ownership has formally moved to the buyer, and the keys have been handed over. The legal and financial side of selling your property is now finalised — your solicitor will be in touch shortly with the completion statement showing exactly how the funds have been distributed (mortgage redemption if applicable, fees, anything else), and the net amount that's coming to you.",
      },
    ],
    whatNext: [
      {
        text: "From our side, this is where we step back — but if anything comes up post-completion (utility queries, post handover questions, anything where you need a pointer), do get in touch. Thank you for trusting us with your sale.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No purchaser body — PM27 handles the buyer's completion notification.

  progressor: {
    subject: [
      { text: "VM20 complete: Completion confirmed on seller's side — {address}" },
    ],
    heroLabel: [
      { text: "VM20 — Completion (seller's side)" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has received confirmation of completion. Sale finalised; funds distributed; ownership transferred." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
