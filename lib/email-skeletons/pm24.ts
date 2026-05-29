// PM24 — Buyer has transferred the deposit.
//
// Auto-NR'd on cash_from_proceeds (deposit comes from the related sale's
// equity at completion, not a pre-exchange transfer). Author copy for the
// two firing shapes (cash_buyer, mortgage).
//
// Vendor: purchaseType delta — mortgage adds "With their mortgage offer
// already in place".
// Purchaser: purchaseType delta — mortgage advance mention at completion.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM24_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's deposit is with their solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Deposit received" },
    ],
    opening: [
      { text: "The buyer's deposit is now with their solicitor, ready to be released on exchange. That's one of the strongest commitment signals in the whole process." },
    ],
    whatHappened: [
      // Cash buyer.
      {
        text: "Money is committed and in place.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — adds mortgage-in-place line.
      {
        text: "With their mortgage offer already in place and the deposit now committed, the buyer's funding is fully lined up.",
        when: { purchaseType: "mortgage" },
      },
    ],
    whatNext: [
      // Cash buyer.
      {
        text: "With the deposit held and contracts signed on both sides, the remaining step is the two solicitors agreeing the exchange moment. Exchange is close.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage.
      {
        text: "The remaining step is the two solicitors agreeing the exchange moment. Exchange is close.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Your deposit is with your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Deposit in" },
    ],
    opening: [
      { text: "Your deposit is now with your solicitor, ready for exchange." },
    ],
    whatHappened: [
      // Cash buyer.
      {
        text: "This is the deposit (usually around 10% of the purchase price) that's released to the seller's side at the moment of exchange. It's held safely by your solicitor until then. The balance of the purchase price follows at completion.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — mortgage advance mentioned at completion.
      {
        text: "This is the deposit (usually around 10% of the purchase price) that's released to the seller's side at the moment of exchange. It's held safely by your solicitor until then. Your mortgage advance, which makes up the rest of the funds, is drawn down from your lender at completion, not at exchange.",
        when: { purchaseType: "mortgage" },
      },
    ],
    whatNext: [
      // Cash buyer.
      {
        text: "With your deposit in place and your contracts signed, you're ready for exchange. Your solicitor will coordinate the exact moment with the seller's side.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage.
      {
        text: "With your deposit in place, your mortgage offer in, and your contracts signed, you're ready for exchange. Your solicitor will coordinate the exact moment with the seller's side.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM24 complete: Deposit transferred — {address}" },
    ],
    heroLabel: [
      { text: "PM24 — Deposit transferred" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer has confirmed transfer of deposit to their solicitor, ready for exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
