// PM23 — Buyer's solicitor has received the signed contract documents
// back from the buyer.
//
// Vendor: shape-stable. Purchaser: closing paragraph branches three ways
// by purchaseType (cash deposit-next / mortgage offer-in-place / chain
// coordination).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM23_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's signed contracts received by their solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's contracts signed" },
    ],
    opening: [
      { text: "The buyer's signed contracts are back with their solicitor. Both sides are now signed and held in escrow." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "The two solicitors will coordinate the exchange moment from here.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Your signed contracts are back with your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Signed contracts in" },
    ],
    opening: [
      { text: "Your signed contracts are back with your solicitor. Your active part of the contract sign-off is complete. Your solicitor will hold the signed documents in escrow and finalise the exchange coordination with the seller's side." },
    ],
    whatHappened: [],
    whatNext: [
      // Cash buyer — deposit-next.
      {
        text: "The remaining step before exchange is your deposit reaching your solicitor, ready to transfer on exchange. Your solicitor will let you know the amount and timing if they haven't already.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — same deposit-next plus mortgage-already-in-place.
      {
        text: "The remaining step before exchange is your deposit reaching your solicitor, ready to transfer on exchange. With your mortgage offer already in place, that's the last piece before the two solicitors can agree the exchange moment. Your solicitor will let you know the deposit amount and timing if they haven't already.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds — chain coordination framing replaces deposit-next.
      {
        text: "Exchange happens when both solicitors confirm everyone's ready: both sides signed, completion date agreed, and on your side, your related sale at the same signed-and-ready stage. Your solicitor coordinates both transactions and will let you know if your sale's timeline needs nudging to keep the two in step.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM23 complete: Buyer's signed contracts received — {address}" },
    ],
    heroLabel: [
      { text: "PM23 — Buyer's signed contracts received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of signed contract documents from the buyer." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
