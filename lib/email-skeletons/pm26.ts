// PM26 — Buyer has received confirmation that contracts have exchanged.
//
// Agent-only confirm. Purchaser only per FINAL — no vendor body (VM19
// handles the seller's notification of the same event). Three purchaseType
// variants on the "deposit / balance funds" wording.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM26_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Contracts have exchanged, your purchase is now legally binding, {address}" },
    ],
    heroLabel: [
      { text: "Contracts exchanged" },
    ],
    opening: [
      { text: "Exchange has happened. Your purchase is now legally binding." },
    ],
    whatHappened: [
      // Cash buyer + mortgage — same wording on the deposit + date line.
      {
        text: "The two solicitors have formally exchanged contracts. Your deposit has transferred to the seller's side, and the agreed completion date is locked in. You're now contractually entitled to buy the property on that date, and the seller is contractually obliged to sell.",
        when: { purchaseType: { in: ["cash_buyer", "mortgage"] } },
      },
      // Cash-from-proceeds — deposit funded from related sale's equity.
      {
        text: "The two solicitors have formally exchanged contracts. Your deposit, funded from your related sale's equity, has been accounted for, and the agreed completion date is locked in. You're now contractually entitled to buy the property on that date, and the seller is contractually obliged to sell.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    whatNext: [
      // Cash buyer — straightforward balance funds.
      {
        text: "The next big moment is completion: the balance funds transfer to the seller, ownership formally becomes yours, and the keys are handed over. Your solicitor will be in touch about transferring the balance funds for completion day. Closer to the date, expect another email with completion-day specifics: timing on the day, where to collect keys, what to do about utilities.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — coordination of mortgage advance + balance funds.
      {
        text: "The next big moment is completion: the balance funds transfer to the seller, ownership formally becomes yours, and the keys are handed over. Your solicitor will be in touch about coordinating your mortgage advance, which your lender draws down for completion day, alongside the balance funds. Closer to the date, expect another email with completion-day specifics: timing on the day, where to collect keys, what to do about utilities.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds — balance funds mostly from related sale's proceeds.
      {
        text: "The next big moment is completion: the balance funds transfer to the seller, ownership formally becomes yours, and the keys are handed over. Your solicitor will be in touch about coordinating the balance funds, most of which come from the proceeds of your related sale completing on the same day. Closer to the date, expect another email with completion-day specifics: timing on the day, where to collect keys, what to do about utilities.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor block per FINAL — VM19 handles seller-side.

  progressor: {
    subject: [
      { text: "PM26 complete: Contracts exchanged — {address}" },
    ],
    heroLabel: [
      { text: "PM26 — Contracts exchanged" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Exchange of contracts confirmed on the purchase." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
