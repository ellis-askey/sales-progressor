// PM21 — Buyer has received the final report from their solicitor.
//
// Non-bilateral, agent or portal indifferent. Vendor body is shape-stable.
// Purchaser body branches by tenure (leasehold adds lease, service charges,
// ground rent, management pack to the report-contents list) and by
// purchaseType (mortgage adds "your mortgage offer and its conditions").
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM21_SKELETON: MilestoneSkeleton = {

  // ── Vendor: shape-stable across the matrix ────────────────────────────
  vendor: {
    subject: [
      { text: "Buyer has the final report, {address}" },
    ],
    heroLabel: [
      { text: "Buyer reading final report" },
    ],
    opening: [
      { text: "The buyer has the final report from their solicitor. That's the structured summary of everything that came out of the conveyancing process. The buyer is now in the reading-and-deciding window before contracts go out for signing." },
    ],
    whatHappened: [
      {
        text: "Contract documents typically follow within a few days of the buyer being comfortable with the report. Your side's contract documents will be issued by your solicitor in parallel.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: branches on tenure × purchaseType ──────────────────────
  purchaser: {
    subject: [
      { text: "Your final report is in, {address}" },
    ],
    heroLabel: [
      { text: "Final report received" },
    ],
    opening: [
      { text: "Your solicitor's final report has landed." },
    ],
    whatHappened: [
      // Freehold × cash_buyer — base list, no leasehold items, no mortgage.
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the search results, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "freehold", purchaseType: "cash_buyer" },
      },
      // Freehold × mortgage — adds mortgage offer + conditions.
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the search results, your mortgage offer and its conditions, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "freehold", purchaseType: "mortgage" },
      },
      // Freehold × cash_from_proceeds — base list (cash-from-proceeds is
      // a funding-source delta, not a report-contents delta).
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the search results, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "freehold", purchaseType: "cash_from_proceeds" },
      },
      // Leasehold × cash_buyer — adds lease, service charges, ground rent,
      // management pack.
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the lease, service charges, ground rent, the management pack from the freeholder, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "leasehold", purchaseType: "cash_buyer" },
      },
      // Leasehold × mortgage — leasehold list + mortgage offer.
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the lease, service charges, ground rent, the management pack from the freeholder, your mortgage offer and its conditions, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "leasehold", purchaseType: "mortgage" },
      },
      // Leasehold × cash_from_proceeds — leasehold list, no mortgage.
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property: title, planning, the lease, service charges, ground rent, the management pack from the freeholder, and anything material that surfaced along the way. It's not new investigation. It's the digest.",
        when: { tenure: "leasehold", purchaseType: "cash_from_proceeds" },
      },
    ],
    whatNext: [
      {
        text: "Read it carefully. This is your considered moment before signing the contracts. Write down anything that's unclear or you want to talk through, and call your solicitor before you sign rather than after. Once you're comfortable, your solicitor will issue the contracts for you to sign.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log (preserved unchanged) ────────────────────
  progressor: {
    subject: [
      { text: "PM21 complete: Buyer received final report — {address}" },
    ],
    heroLabel: [
      { text: "PM21 — Final report received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed receipt of final report from purchaser solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
