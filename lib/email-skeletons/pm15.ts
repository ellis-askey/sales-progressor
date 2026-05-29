// PM15 — Buyer's solicitor has received initial replies from the seller's
// solicitor.
//
// Bilateral natural SECOND-actor in the (VM12, PM15) pair. PM15's purchaser
// block is the acted-side (4 variants: route × direction). PM15's vendor
// block is the inverse-direction hand-off nudge only.
//
// Shape-stable per FINAL — no tenure or purchaseType deltas.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM15_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement (4 variants) ────────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the replies have arrived, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Replies to your enquiries received by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the replies have arrived, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Replies receipt logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Replies received" },
    ],

    opening: [
      {
        text: "Thanks. The seller's formal replies are now with your solicitor.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Your solicitor has received the seller's formal replies. We've logged it on your purchase.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. The seller's formal replies are now with your solicitor, ahead of the seller's side confirming the issuance.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Your solicitor has received the seller's formal replies. We've logged it on your purchase, ahead of the seller's side confirming the issuance.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default direction — review framing.
      {
        text: "Your solicitor will work through them carefully, checking that each answer satisfies the question raised, flagging anything unclear or left open, and identifying anything that needs follow-up.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "They'll work through the replies carefully, checking each answer against the question raised, flagging anything unclear, and identifying anything that needs follow-up. The review usually takes a few days to a week.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse direction — no scope paragraph.
    ],

    whatNext: [
      {
        text: "The review usually takes a few days to a week. Your solicitor will be in touch with anything material once they've worked through it.",
        when: { direction: "default", route: "client_portal" },
      },
      // Default × Internal — no whatNext (the review framing was the closer).
      // Inverse — brief next-step line.
      {
        text: "Your solicitor will work through the replies and be in touch with anything material once they've concluded.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: inverse-direction hand-off nudge ──────────────────────────
  vendor: {
    subject: [
      {
        text: "Buyer's side has confirmed receipt of the replies, {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Buyer has the replies", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The buyer's side has logged receipt of the formal replies ahead of your side confirming they went out.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor confirms the issuance, open your portal and tap the highlighted confirm button to bring the two in sync. Takes about ten seconds.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM15 complete: Initial replies received — {address}" },
    ],
    heroLabel: [
      { text: "PM15 — Initial replies received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of initial replies from the seller's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
