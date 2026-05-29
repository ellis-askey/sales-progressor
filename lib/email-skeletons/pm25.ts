// PM25 — Buyer's solicitor has confirmed readiness to exchange.
//
// Agent-only confirm. Vendor: purchaseType deltas on readiness list
// (mortgage offer + deposit-transferred vs deposit-from-related-sale).
// Purchaser: purchaseType deltas on readiness list and on chain
// coordination paragraph.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM25_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's side is ready to exchange, {address}" },
    ],
    heroLabel: [
      { text: "Buyer ready to exchange" },
    ],
    opening: [
      // Cash buyer.
      {
        text: "The buyer's solicitor has formally confirmed everything on their side is in place: contracts signed, conveyancing complete, deposit transferred and held ready.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — adds mortgage offer in.
      {
        text: "The buyer's solicitor has formally confirmed everything on their side is in place: contracts signed, conveyancing complete, mortgage offer in, deposit transferred and held ready.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds — deposit covered through related sale.
      {
        text: "The buyer's solicitor has formally confirmed everything on their side is in place: contracts signed, conveyancing complete, deposit covered through the buyer's related sale.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Once both sides have formally confirmed, exchange follows.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Your solicitor is ready to exchange, {address}" },
    ],
    heroLabel: [
      { text: "Ready to exchange" },
    ],
    opening: [
      { text: "Your solicitor has confirmed they're ready to exchange." },
    ],
    whatHappened: [
      // Cash buyer — basic readiness list.
      {
        text: "Everything on your side is in place: contracts signed and held in escrow, conveyancing complete, deposit transferred and ready, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the seller's side is also there.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — adds mortgage offer in.
      {
        text: "Everything on your side is in place: contracts signed and held in escrow, conveyancing complete, mortgage offer in, deposit transferred and ready, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the seller's side is also there.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds — adds related sale to readiness condition.
      {
        text: "Everything on your side is in place: contracts signed and held in escrow, conveyancing complete, completion date agreed. Your solicitor has formally confirmed they're ready to proceed to exchange whenever the seller's side, and your related sale, are also there.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    whatNext: [
      // Cash buyer + mortgage.
      {
        text: "Exchange happens when both solicitors are ready and agree the moment. The next time you hear from us, exchange will have happened.",
        when: { purchaseType: { in: ["cash_buyer", "mortgage"] } },
      },
      // Cash-from-proceeds — chain coordination paragraph.
      {
        text: "Exchange happens when both solicitors are ready and agree the moment. Because your purchase exchange has to be coordinated with your related sale's exchange, your solicitor will be working with both sets of solicitors to land all the moving pieces together. The next time you hear from us, exchange will have happened.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM25 complete: Buyer ready to exchange — {address}" },
    ],
    heroLabel: [
      { text: "PM25 — Buyer ready to exchange" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed readiness to exchange." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
