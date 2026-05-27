// VM16 — Seller's solicitor has issued contract documents to the seller.
//
// Universal across shape. Substantive beat for the seller (here are the
// documents to sign); brief heads-up for the buyer (seller is signing
// on their side). The buyer-side counterpart is PM22 (which fires when
// the buyer's own solicitor issues docs to the buyer); both fire on
// the same file, so the buyer reads both — VM16 purchaser body is
// deliberately brief because PM22 purchaser body carries the buyer's
// own signing moment.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM16_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Contracts ready for your signature — {address}" },
    ],
    heroLabel: [
      { text: "Contracts to sign" },
    ],
    opening: [
      { text: "Your contracts are ready for signing." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has issued the contract pack to you — the final draft contract, the transfer deed, and any other documents that need your signature. This is the formal signing step before exchange.",
      },
    ],
    whatNext: [
      {
        text: "Read through everything before signing — your solicitor should have walked you through anything notable, but it's worth checking the price, the names, the property address, and any agreed inclusions/exclusions match what you're expecting. Sign and return promptly; your solicitor will hold the signed documents in escrow until the exchange moment.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is signing the contracts — {address}" },
    ],
    heroLabel: [
      { text: "Seller signing" },
    ],
    opening: [
      { text: "The seller's contracts are with them for signing." },
    ],
    whatHappened: [
      {
        text: "The seller's solicitor has sent the contract documents to the seller for signing. Their solicitor will hold the signed documents in escrow once they're back.",
      },
    ],
    // No whatNext — the buyer's own signing moment is PM22, where the
    // substantive forward-look belongs. Holding this body brief keeps
    // it as a one-beat heads-up, not a parallel "here's what comes
    // next" template.
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
      { text: "Vendor solicitor has confirmed issue of contract documents to vendor for signing." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
