// VM12 — Seller's solicitor has issued initial responses to the buyer's
// solicitor.
//
// Bilateral natural first-actor in the (VM12, PM15) pair (seller issues,
// buyer receives). VM12's vendor block is the acted-side (4 variants:
// route × direction). VM12's purchaser block is the default-direction
// hand-off nudge only.
//
// Shape-stable per FINAL — no tenure or purchaseType deltas.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM12_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement (4 variants) ───────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed the replies have gone out, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Replies to enquiries issued by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the replies have gone out, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Replies-issuance logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Replies issued" },
    ],

    opening: [
      {
        text: "Thanks. You've confirmed your solicitor has sent the formal replies to the buyer's side.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Your solicitor has issued the formal replies to the buyer's side. We've logged it on your sale.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. You've confirmed your solicitor sent the formal replies, and the buyer's side has already logged receipt on their end.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Your solicitor has issued the formal replies to the buyer's side. We've logged it on your sale, ahead of the buyer-side having logged receipt.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [],

    whatNext: [
      // Default × Portal — full framing on follow-up enquiries.
      {
        text: "The first round of enquiry handling is now in the buyer's solicitor's hands. They'll review your replies over the next few days to a week. If your answers satisfy them, the file moves on. If anything's left open, they'll come back with follow-up enquiries, and your solicitor will handle those.",
        when: { direction: "default", route: "client_portal" },
      },
      // Default × Internal — same framing.
      {
        text: "The first round of enquiry handling is now in the buyer's solicitor's hands. They'll review your replies over the next few days to a week. If your answers satisfy them, the file moves on. If anything's left open, they'll come back with follow-up enquiries.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse — both routes share the shorter "in sync" framing.
      {
        text: "Both sides are now in sync. The buyer's solicitor will review the replies over the next few days to a week.",
        when: { direction: "inverse", route: "client_portal" },
      },
      {
        text: "The buyer's solicitor will review the replies over the next few days to a week.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: default-direction hand-off nudge ───────────────────────
  purchaser: {
    subject: [
      {
        text: "Replies to your enquiries are on the way, {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Replies inbound", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "The seller's solicitor has issued the formal replies to your initial enquiries, and they're on their way to your solicitor.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor confirms they've landed, open your portal and tap the highlighted confirm button. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM12 complete: Replies issued — {address}" },
    ],
    heroLabel: [
      { text: "VM12 — Replies issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed issuing initial replies to the buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
