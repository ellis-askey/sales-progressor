// PM27 — Buyer has received confirmation that the sale has completed.
//
// Agent-only confirm. Purchaser only per FINAL — no vendor body (VM20
// handles seller-side). PurchaseType delta on opening sentence and on
// Land Registry sentence (mortgage adds advance + lender's charge).
// Tenure × purchaseType delta on work-recap list (leasehold adds "the
// management pack"; mortgage adds "the mortgage").
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM27_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Completion, the property is yours, {address}" },
    ],
    heroLabel: [
      { text: "Property is yours" },
    ],
    opening: [
      { text: "Completion has happened. The property is yours." },
    ],
    whatHappened: [
      // Freehold × cash buyer / cash_from_proceeds — base opening + recap.
      {
        text: "The balance funds have transferred to the seller's side, ownership has formally moved across to you, and the keys are now yours. Everything from the offer-accepted moment to this one, the conveyancing, the enquiries, the searches, the survey, the contracts, all of it was the work that gets you to here.",
        when: { tenure: "freehold", purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Freehold × mortgage — opening adds mortgage advance, recap adds "the mortgage".
      {
        text: "The balance funds, including your mortgage advance drawn down from your lender, have transferred to the seller's side, ownership has formally moved across to you, and the keys are now yours. Everything from the offer-accepted moment to this one, the conveyancing, the enquiries, the searches, the survey, the mortgage, the contracts, all of it was the work that gets you to here.",
        when: { tenure: "freehold", purchaseType: "mortgage" },
      },
      // Leasehold × cash buyer / cash_from_proceeds — base opening, recap adds "the management pack".
      {
        text: "The balance funds have transferred to the seller's side, ownership has formally moved across to you, and the keys are now yours. Everything from the offer-accepted moment to this one, the conveyancing, the enquiries, the searches, the survey, the contracts, the management pack, all of it was the work that gets you to here.",
        when: { tenure: "leasehold", purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Leasehold × mortgage — opening adds mortgage advance, recap adds both "the mortgage" and "the management pack".
      {
        text: "The balance funds, including your mortgage advance drawn down from your lender, have transferred to the seller's side, ownership has formally moved across to you, and the keys are now yours. Everything from the offer-accepted moment to this one, the conveyancing, the enquiries, the searches, the survey, the mortgage, the management pack, the contracts, all of it was the work that gets you to here.",
        when: { tenure: "leasehold", purchaseType: "mortgage" },
      },
    ],
    whatNext: [
      // Cash buyer + cash_from_proceeds — straightforward Land Registry sentence.
      {
        text: "Your solicitor will register the transfer with the Land Registry over the coming weeks. That's the formal legal record-keeping step, behind the scenes, no action from you. Practically: pick up the keys, switch the utilities into your name (your solicitor's completion statement will have the meter readings taken on the day), update your address with the bank, employer, DVLA, and the rest. Get the locks changed if you're inclined.\n\nFrom our side, this is where we step back. Thank you for letting us help you through it. It's a real moment, and we hope the place becomes everything you wanted it to be.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage — adds "including your lender's charge on the property".
      {
        text: "Your solicitor will register the transfer with the Land Registry over the coming weeks, including your lender's charge on the property. That's the formal legal record-keeping step, behind the scenes, no action from you. Practically: pick up the keys, switch the utilities into your name (your solicitor's completion statement will have the meter readings taken on the day), update your address with the bank, employer, DVLA, and the rest. Get the locks changed if you're inclined.\n\nFrom our side, this is where we step back. Thank you for letting us help you through it. It's a real moment, and we hope the place becomes everything you wanted it to be.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor block per FINAL — VM20 handles seller-side.

  progressor: {
    subject: [
      { text: "PM27 complete: Purchase completed — {address}" },
    ],
    heroLabel: [
      { text: "PM27 — Purchase completed" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Completion of purchase confirmed." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
