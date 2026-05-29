// VM17 — Seller's solicitor has received signed contract documents back
// from the seller.
//
// Vendor only per FINAL — no purchaser email fires.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM17_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Signed contracts received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Signed contracts in" },
    ],
    opening: [
      { text: "Your signed contracts are back with your solicitor." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Your active part of the contract sign-off is complete. Your solicitor will hold the signed documents in escrow. Once both sides are signed, the two solicitors can begin coordinating the actual exchange moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No purchaser block per FINAL — VM17 fires to vendor only.

  progressor: {
    subject: [
      { text: "VM17 complete: Signed contracts received — {address}" },
    ],
    heroLabel: [
      { text: "VM17 — Signed contracts received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed receipt of signed contract documents from the seller." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
