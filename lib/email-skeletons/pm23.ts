// PM23 — Buyer's solicitor has received the signed contract documents
// back from the buyer.
//
// Universal across shape (except funding: CFP gets a brief concurrent-
// sale note because the buyer's purchase contracts being signed has to
// align with their sale's contracts being signed for exchange to happen).
// Mirror of VM17 on the buyer side, but carries more weight as the
// emotional moment: with both sides now signed, exchange becomes the
// next imminent step.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM23_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your signed contracts are back with your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Contracts signed" },
    ],
    opening: [
      { text: "Your signed contracts are back with your solicitor." },
    ],
    whatHappened: [
      {
        text: "Your active part of the contract sign-off is complete. Your solicitor will hold the signed documents in escrow and finalise the exchange coordination with the seller's side.",
      },
    ],
    whatNext: [
      // Universal — exchange-imminent framing + deposit reminder.
      {
        text: "Exchange happens when both solicitors confirm everyone's ready — deposit funds with your solicitor, both sides signed, completion date agreed. If you haven't already transferred the deposit, your solicitor will be coordinating that with you separately. We'll let you know the moment exchange happens.",
      },
      // CFP variant — concurrent sale must be at the same stage. Real
      // gating concern at this milestone (you can't exchange your
      // purchase without your sale exchanging in parallel).
      {
        text: "On your concurrent sale, your side has to be at the same signed-and-ready stage for exchange to happen — your solicitor coordinates both transactions and will let you know if your sale's timeline needs nudging to keep the two in step.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has signed the contracts — {address}" },
    ],
    heroLabel: [
      { text: "Buyer signed" },
    ],
    opening: [
      { text: "The buyer has signed." },
    ],
    whatHappened: [
      // Order-agnostic — VM17 and PM23 can fire in either order. Earlier
      // draft said "Both sides are now at the signed-and-held-in-escrow
      // stage", which presupposes the seller has already signed.
      {
        text: "The buyer has signed and returned their contract documents. The conveyancing work on the buyer's side is done; once both sides' signed contracts are in escrow, exchange is the next moment.",
      },
    ],
    whatNext: [
      // Order-agnostic — earlier draft said "the two solicitors will now
      // agree the exchange timing — usually within a few days", which
      // assumes the seller has already signed.
      {
        text: "If the seller's side is also signed, the two solicitors can move straight to agreeing an exchange moment — usually within a few days, sometimes the same day. If their signing is still in flight, exchange follows as soon as that lands. Either way, exchange is the next milestone we'll fire on this file.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM23 complete: Buyer signed contracts returned — {address}" },
    ],
    heroLabel: [
      { text: "PM23 — Buyer signed contracts received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed receipt of signed contract documents from purchaser. Both sides now signed and ready for exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
