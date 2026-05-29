// PM22 — Buyer's solicitor has issued contract documents to the buyer.
//
// Vendor: shape-stable. Purchaser: mortgage delta adds "the mortgage deed"
// to the signing list; cash_from_proceeds delta adds the chain-coordination
// reminder paragraph.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM22_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer has the contracts, {address}" },
    ],
    heroLabel: [
      { text: "Buyer signing contracts" },
    ],
    opening: [
      { text: "The buyer now has their contract documents from their solicitor. Like you, they're in their signing window." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Once their signed documents are back with their solicitor, both sides are ready to begin coordinating exchange.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Contracts ready for your signature, {address}" },
    ],
    heroLabel: [
      { text: "Contracts ready to sign" },
    ],
    opening: [
      // Cash / cash-from-proceeds — no mortgage deed.
      {
        text: "Your contracts are ready for signing. Your solicitor has issued the contract pack to you: the final draft contract, the transfer deed, and any other documents that need your signature. This is the formal signing step before exchange.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage — adds the mortgage deed.
      {
        text: "Your contracts are ready for signing. Your solicitor has issued the contract pack to you: the final draft contract, the transfer deed, the mortgage deed, and any other documents that need your signature. This is the formal signing step before exchange.",
        when: { purchaseType: "mortgage" },
      },
    ],
    whatHappened: [
      {
        text: "Read through everything before signing. Your solicitor should have walked you through anything notable, but check the price, the names, the property address, and any agreed inclusions or exclusions match what you're expecting. Sign and return promptly. Your solicitor will hold the signed documents in escrow until exchange.",
      },
    ],
    whatNext: [
      // Cash-from-proceeds — chain-coordination reminder fires.
      {
        text: "A reminder on your related sale: it has to exchange before this purchase can. If your sale isn't yet at the signed-and-ready stage, that's the remaining piece in front of exchange. Your solicitor will coordinate the two transactions to exchange together.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Cash buyer + mortgage — no closing paragraph.
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM22 complete: Contracts issued to buyer — {address}" },
    ],
    heroLabel: [
      { text: "PM22 — Contracts issued to buyer" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed issuing contract documents to the buyer for signature." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
