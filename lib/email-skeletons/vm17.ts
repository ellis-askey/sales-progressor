// VM17 — Seller's solicitor has received signed contract documents back
// from the seller.
//
// Job B addition (2026-05-29): adds a purchaser block telling the buyer
// the seller has signed and returned their contracts. Three funding
// variants on the closing line:
//   - cash_buyer / mortgage: closes with deposit-with-solicitor
//   - cash_from_proceeds:    closes with exchange-readiness on related sale
//
// Also part of the same Job B sweep: replace "in escrow" with
// "in readiness" in the vendor whatNext for tone consistency with the
// new purchaser block.
//
// Source: FINAL email matrix; purchaser block from three-new-counterpart-
// emails.md.

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
        text: "Your active part of the contract sign-off is complete. Your solicitor will hold the signed documents in readiness. Once both sides are signed, the two solicitors can begin coordinating the actual exchange moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller has signed the contracts, {address}" },
    ],
    heroLabel: [
      { text: "Seller has signed" },
    ],
    opening: [
      { text: "The seller has signed their contracts and returned them to their solicitor." },
    ],
    whatHappened: [],
    whatNext: [
      // Cash buyer + mortgage — closes with deposit-with-solicitor framing.
      {
        text: "That's the seller's half of contract sign-off complete. Their solicitor is now holding the signed documents in readiness. Once your own contracts are signed and back with your solicitor, both sides will be ready to begin coordinating the actual exchange moment. From here, the file moves at the pace of your contract sign-off and your deposit reaching your solicitor.",
        when: { purchaseType: { in: ["cash_buyer", "mortgage"] } },
      },
      // Cash-from-proceeds — closes with related-sale exchange-readiness framing.
      {
        text: "That's the seller's half of contract sign-off complete. Their solicitor is now holding the signed documents in readiness. Once your own contracts are signed and back with your solicitor, both sides will be ready to begin coordinating the actual exchange moment. From here, the file moves at the pace of your contract sign-off and exchange readiness on your related sale.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

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
