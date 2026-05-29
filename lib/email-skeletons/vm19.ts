// VM19 — Seller has received confirmation that contracts have exchanged.
//
// Agent-only confirm. Vendor only per FINAL — no purchaser body (PM26
// handles the buyer's notification). Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM19_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Contracts have exchanged, your sale is now legally binding, {address}" },
    ],
    heroLabel: [
      { text: "Contracts exchanged" },
    ],
    opening: [
      { text: "Exchange has happened. Your sale is now legally binding." },
    ],
    whatHappened: [
      {
        text: "The two solicitors have formally exchanged contracts. The buyer's deposit is now released to the seller's side, and the agreed completion date is locked in. Neither party can pull out without significant legal and financial consequences. The sale is essentially certain at this point.",
      },
    ],
    whatNext: [
      {
        text: "The next major moment is completion: when the balance funds transfer, ownership formally moves to the buyer, and keys are handed over. Closer to the date, expect another email with completion-day specifics: key handover, meter readings, vacating the property.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No purchaser block per FINAL — PM26 handles buyer-side.

  progressor: {
    subject: [
      { text: "VM19 complete: Contracts exchanged — {address}" },
    ],
    heroLabel: [
      { text: "VM19 — Contracts exchanged" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Exchange of contracts confirmed on the sale." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
