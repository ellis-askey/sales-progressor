// VM2 — Seller has received the memorandum of sale.
//
// The MOS is the formal kick-off document sent by the agent to all
// solicitors confirming agreed price + parties. Both sides receive the
// same event from different angles.
//
// Shape relevance:
//   - Tenure: vendor's "what next" mentions the management pack on
//     leasehold (their solicitor will be requesting it imminently).
//   - Funding: minimal — MOS isn't a funding-conditional moment for
//     the seller; the buyer's PM2 covers the mortgage angle.
//
// No bilateral pair. Single fan-out per side.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM2_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Memorandum of sale issued — {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      // Varied vs PM2 purchaser ("The memorandum of sale is with your
      // solicitor") and VM2 purchaser (heads-up about seller's side) —
      // each body opens distinctly so neither reader sees a templated
      // repeat across the two MoS-receipt milestones.
      { text: "Your solicitor has the green light to start." },
    ],
    whatHappened: [
      {
        text: "The memorandum of sale has been sent to all solicitors, confirming the agreed price and the details of both parties — that's the document that formally kicks off conveyancing on your side.",
      },
    ],
    whatNext: [
      // Universal — returning the welcome pack is the universal advice.
      {
        text: "Your solicitor will now begin preparing the contract pack. Returning your solicitor's welcome pack quickly is the single biggest thing you can do this week to keep the transaction moving.",
      },
      // Leasehold note — opens "On a leasehold sale…" rather than
      // "Because…" so when it stacks with other shape-conditional
      // paragraphs the cadence varies between segments.
      {
        text: "While the contract pack's being prepared, your solicitor will also be requesting the management pack from your freeholder or managing agent. Those packs can take several weeks to come back on their own clock.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Memorandum of sale issued — {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      // Distinct from PM2 purchaser opening ("The memorandum of sale
      // is with your solicitor") — the buyer reads both bodies close
      // together, so this names the seller's side rather than the
      // buyer's own.
      { text: "The seller's solicitor has the memorandum of sale." },
    ],
    whatHappened: [
      {
        text: "The MoS has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. With the seller's solicitor now in the loop, conveyancing is formally underway on both sides.",
      },
    ],
    whatNext: [
      // Universal — return the welcome pack + ID is the foundation.
      {
        text: "If you haven't already, return your solicitor's welcome pack and complete your ID checks — your solicitor can't get fully started on your purchase until these are done.",
      },
      // Mortgage variant — keep the lender side moving in parallel.
      {
        text: "If you're at the application stage on your mortgage, keep that progressing too — the sooner it's submitted, the sooner the valuation and offer follow.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds variant — opens "Your concurrent sale…"
      // (not "Because…") so it pairs cleanly with the leasehold
      // paragraph below on Leasehold × CFP without both add-ons leading
      // with the same conjunction.
      {
        text: "Your concurrent sale is part of the picture too — that sale's exchange is the gating step for your purchase's exchange, so keep us posted on how it's moving.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Tenure addendum — leasehold heads-up. Opens "One thing to flag…"
      // for cadence variation when it stacks with the CFP paragraph
      // above on Leasehold × CFP.
      {
        text: "One thing to flag on a leasehold purchase like this — the seller's solicitor will be requesting a management pack from the freeholder around now. Those packs often take several weeks to come back on their own clock, so worth knowing now rather than later.",
        when: { tenure: "leasehold" },
      },
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
