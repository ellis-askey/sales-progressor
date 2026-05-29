// VM20 — Seller has received confirmation that the sale has completed.
//
// Agent-only confirm. Vendor only per FINAL — no purchaser body
// (PM27 handles buyer-side). Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM20_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Completion, your sale is done, {address}" },
    ],
    heroLabel: [
      { text: "Sale completed" },
    ],
    opening: [
      { text: "Completion has happened. Your sale is done." },
    ],
    whatHappened: [
      {
        text: "The balance funds have transferred to your solicitor, ownership has formally moved to the buyer, and the keys have been handed over. The legal and financial side of selling your property is now finalised. Your solicitor will be in touch shortly with the completion statement showing how the funds have been distributed, and the net amount that's coming to you.",
      },
    ],
    whatNext: [
      {
        text: "From our side, this is where we step back. If anything comes up post-completion (utility queries, post-handover questions, anything where you need a pointer), do get in touch. Thank you for trusting us with your sale.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No purchaser block per FINAL — PM27 handles buyer-side.

  progressor: {
    subject: [
      { text: "VM20 complete: Sale completed — {address}" },
    ],
    heroLabel: [
      { text: "VM20 — Sale completed" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Completion of sale confirmed." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
