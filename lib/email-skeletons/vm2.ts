// VM2 — Seller has received the memorandum of sale.
//
// Non-bilateral, no route/direction conditioning. Tenure branches on the
// vendor's middle paragraph (leasehold mentions chasing the management
// pack alongside contract-pack assembly). Purchaser branches on
// purchaseType (cash-from-proceeds adds the related-sale reminder).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM2_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Memorandum of sale issued, {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      { text: "The memorandum of sale has gone out. It's the document confirming the agreed price and the names of both parties, and it formally kicks off conveyancing on your side." },
    ],
    whatHappened: [
      // Freehold version.
      {
        text: "Your solicitor will now begin assembling the contract pack. If you've already had the welcome pack from your solicitor, getting that back is the single biggest thing you can do this week to keep the sale moving. If it hasn't landed yet, expect it imminently.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds the management-pack chase.
      {
        text: "Your solicitor will now begin assembling the contract pack and chasing the management pack from your freeholder. If you've already had the welcome pack from your solicitor, getting that back is the single biggest thing you can do this week to keep the sale moving. If it hasn't landed yet, expect it imminently.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Memorandum of sale issued, {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      { text: "The memorandum of sale has gone out, confirming the agreed purchase price and the names of both parties. With it issued, conveyancing is now formally underway on both sides." },
    ],
    whatHappened: [
      {
        text: "If you haven't already, return your solicitor's welcome pack and complete your ID checks. They can't get fully started on your purchase until those are in.",
      },
    ],
    whatNext: [
      // Cash-from-proceeds — adds the related-sale reminder.
      {
        text: "A reminder on your related sale: it has to exchange before this purchase can. Keep us posted on how it's progressing, and your solicitor will be coordinating timing across both.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Cash buyer and mortgage have no whatNext paragraph here.
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM2 complete: MoS received — {address}" },
    ],
    heroLabel: [
      { text: "VM2 — MoS received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Memorandum of sale confirmed received by vendor's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
