// VM16 — Seller's solicitor has issued contract documents to the seller.
//
// Shape-stable across the matrix.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM16_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Contracts ready for your signature, {address}" },
    ],
    heroLabel: [
      { text: "Contracts ready to sign" },
    ],
    opening: [
      { text: "Your contracts are ready for signing. Your solicitor has issued the contract pack to you: the final draft contract, the transfer deed, and any other documents that need your signature. This is the formal signing step before exchange." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Read through everything before signing. Your solicitor should have walked you through anything notable, but check the price, the names, the property address, and any agreed inclusions or exclusions match what you're expecting. Sign and return promptly. Your solicitor will hold the signed documents in readiness for exchange.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is signing the contracts, {address}" },
    ],
    heroLabel: [
      { text: "Seller signing contracts" },
    ],
    opening: [
      { text: "The seller's contracts are with them for signing. Their solicitor has sent the contract documents to the seller, and will hold the signed documents in readiness once they're back." },
    ],
    whatHappened: [],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM16 complete: Contracts issued to seller — {address}" },
    ],
    heroLabel: [
      { text: "VM16 — Contracts issued to seller" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed issuing contract documents to the seller for signature." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
