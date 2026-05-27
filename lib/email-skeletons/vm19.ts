// VM19 — Seller has received confirmation that contracts have exchanged.
//
// Agent-only confirm. Vendor-only — no purchaser body. Rationale:
// exchange is a singular legal event; both sides receive notification
// simultaneously, but each side is notified via its own milestone
// (VM19 for vendor, PM26 for purchaser). Firing cross-side would
// duplicate the same news. This skeleton's job is the seller's
// exchange-moment notification specifically.
//
// Tone: this is one of the genuinely transformative moments of the
// whole journey — the sale becomes legally binding. Earn it without
// going saccharine.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM19_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Contracts have exchanged — your sale is now legally binding — {address}" },
    ],
    heroLabel: [
      { text: "Exchanged" },
    ],
    opening: [
      { text: "Exchange has happened — your sale is now legally binding." },
    ],
    whatHappened: [
      {
        text: "The two solicitors have formally exchanged contracts. The buyer's deposit is now released to the seller's side, and the agreed completion date is locked in. Neither party can pull out without significant legal and financial consequences — the sale is essentially certain at this point.",
      },
    ],
    whatNext: [
      {
        text: "The next major moment is completion — when the balance funds transfer, ownership formally moves to the buyer, and keys are handed over. Closer to the date, expect another email with completion-day specifics — key handover, meter readings, vacating the property.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No purchaser body — PM26 handles the buyer's exchange notification.

  progressor: {
    subject: [
      { text: "VM19 complete: Exchange confirmed on seller's side — {address}" },
    ],
    heroLabel: [
      { text: "VM19 — Exchange (seller's side)" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has received confirmation of exchange of contracts. Sale legally binding; completion date locked in." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
