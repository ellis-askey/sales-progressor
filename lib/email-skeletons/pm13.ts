// PM13 — Buyer's solicitor has received the search results.
//
// Non-bilateral. Two shape conditionals:
//   - Tenure (leasehold): vendor + purchaser mention "the management pack"
//     alongside the contract pack in the review-context line.
//   - PurchaseType (mortgage): purchaser adds the lender-may-want-to-see-
//     how-it's-resolved paragraph.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM13_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's search results are in, {address}" },
    ],
    heroLabel: [
      { text: "Searches results in" },
    ],
    opening: [
      { text: "The buyer's solicitor has the search results back." },
    ],
    whatHappened: [
      // Freehold version.
      {
        text: "They'll review them alongside the contract pack to build the full picture of the property.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds management pack.
      {
        text: "They'll review them alongside the contract pack and the management pack to build the full picture of the property.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      {
        text: "If anything material surfaces that needs clarification from your side, it'll come through as an enquiry, and your solicitor will reach you directly on any point that needs your input.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Search results received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Search results received" },
    ],
    opening: [
      { text: "Your solicitor has the search results back." },
    ],
    whatHappened: [
      // Freehold version.
      {
        text: "They'll review them now alongside the contract pack.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — adds management pack.
      {
        text: "They'll review them now alongside the contract pack and the management pack.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      // Cash / cash-from-proceeds version.
      {
        text: "The review typically takes a few days to a week. Any enquiries that flow from the results will land with the seller's solicitor soon after. If something material surfaces that needs your read or a decision, your solicitor will be in touch directly.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage version — adds lender-resolution paragraph.
      {
        text: "The review typically takes a few days to a week. Any enquiries that flow from the results will land with the seller's solicitor soon after. One thing worth knowing on a mortgage purchase: if a search throws up something material, your lender may want to see how it's being resolved before they're comfortable releasing funds. That's not unusual, and your solicitor handles the lender liaison if it comes up. It's just worth knowing search findings can touch the financing side, not only the conveyancing.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM13 complete: Search results received — {address}" },
    ],
    heroLabel: [
      { text: "PM13 — Search results received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of search results." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
