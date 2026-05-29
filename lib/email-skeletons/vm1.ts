// VM1 — Seller has instructed their solicitor.
//
// Non-bilateral, no route/direction conditioning. Vendor + purchaser
// each branch on tenure (leasehold adds the TA7 + management pack
// content) and the purchaser additionally branches on buyerFunding
// (cash_from_proceeds adds the related-sale paragraph).
//
// Source: FINAL email matrix (rewrite of the audit-flagged copy).
// SHAPE-NOTES annotations honoured: TA7 / management pack are
// leasehold-only; chain-dependency paragraph is cash_from_proceeds-only.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM1_SKELETON: MilestoneSkeleton = {

  // ── Vendor: the seller who just instructed their solicitor ────────────
  vendor: {
    subject: [
      { text: "Your solicitor's instructed, {address}" },
    ],
    heroLabel: [
      { text: "Solicitor instructed" },
    ],
    opening: [
      { text: "Your solicitor's instructed. That's conveyancing formally underway on your side." },
    ],
    whatHappened: [
      // Freehold version — TA6 + TA10 only.
      {
        text: "They'll start preparing the contract pack now: title documents, the property forms you'll need to fill in (TA6 and TA10), and anything else that needs to go to the buyer's solicitor. The next thing you'll see from them is their welcome pack landing in the next few days.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — TA7 added to the form list.
      {
        text: "They'll start preparing the contract pack now: title documents, the property forms you'll need to fill in (TA6, TA10, and TA7, the leasehold one), and anything else that needs to go to the buyer's solicitor. The next thing you'll see from them is their welcome pack landing in the next few days.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      // Freehold — welcome-pack chase advice as the closer.
      {
        text: "When the welcome pack arrives, turning it around quickly is the single biggest thing you can do to keep the sale moving early on.",
        when: { tenure: "freehold" },
      },
      // Leasehold — management-pack-chase advice replaces the welcome-pack
      // line, because the management pack is the dominant pacing constraint
      // on a leasehold sale.
      {
        text: "One thing worth knowing now, because it's a leasehold sale: the management pack from your freeholder is the slowest piece, and it can take several weeks. Your solicitor will request it around now, but if you have a direct relationship with your freeholder or managing agent, a polite follow-up call from you a couple of weeks in often helps move it along.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: buyer hearing the seller's side has kicked off ─────────
  purchaser: {
    subject: [
      { text: "The seller's solicitor is instructed, {address}" },
    ],
    heroLabel: [
      { text: "Seller's solicitor instructed" },
    ],
    opening: [
      { text: "The seller's solicitor is instructed. Conveyancing is now underway on their side." },
    ],
    whatHappened: [
      // Freehold version — short pack description.
      {
        text: "They'll start preparing the contract pack: title documents and the property information forms. Once it's assembled, it goes across to your solicitor to review.",
        when: { tenure: "freehold" },
      },
      // Leasehold version — management-pack timing warning.
      {
        text: "They'll start preparing the contract pack: title documents, property forms, and the leasehold paperwork. The management pack from the freeholder is the slowest piece on a leasehold sale. It can take several weeks, and it's the most common cause of delay early in the process.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      // Cash buyer + mortgage variant — simple "nothing for you to do"
      // closer pointing at the buyer's own welcome pack as the next event.
      {
        text: "Nothing for you to do right now. The next thing you'll see on your side is the welcome pack from your own solicitor.",
        when: { purchaseType: { in: ["cash_buyer", "mortgage"] } },
      },
      // Cash-from-proceeds variant — adds the related-sale framing so the
      // buyer understands their two transactions are now running in parallel.
      {
        text: "Nothing for you to do right now. Because you're funding this purchase from your own sale's equity, the two transactions are running side by side from here. We'll keep you posted on both, and your solicitor will be coordinating the timing across them.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log, shape-stable (preserved unchanged) ──────
  progressor: {
    subject: [
      { text: "VM1 complete: Seller instructed solicitor — {address}" },
    ],
    heroLabel: [
      { text: "VM1 — Seller instructed solicitor" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed solicitor instruction." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
