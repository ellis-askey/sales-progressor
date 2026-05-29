// PM17 — Buyer's solicitor has raised additional enquiries.
//
// Bilateral first-actor in the (PM17, VM13) pair. PM17.purchaser is the
// acted side (4 variants: route × direction). PM17.vendor is the
// default-direction hand-off nudge to the seller; the inverse-direction
// hand-off belongs on VM13.purchaser.
//
// Phase 11 is funding- and tenure-agnostic on the bilateral acted-side
// copy. No conditioning beyond route × direction.
//
// Source: FINAL email matrix (journey-freehold-cash_buyer-FINAL.md,
// Phase 11, PM17 block).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM17_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side ack (4 variants: route × direction) ─────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the follow-up enquiries have gone out, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Additional enquiries raised on your purchase, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the follow-up enquiries have gone out, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Follow-up enquiries raise logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Additional enquiries raised" },
    ],

    opening: [
      // Default × Portal.
      {
        text: "Thanks. You've confirmed your solicitor has raised the follow-up enquiries with the seller's side.",
        when: { route: "client_portal", direction: "default" },
      },
      // Default × Internal.
      {
        text: "Your solicitor has raised the follow-up enquiries with the seller's side. We've logged it on your purchase.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      // Inverse × Portal — seller-side already logged receipt.
      {
        text: "Thanks. You've confirmed your solicitor has raised the follow-up enquiries, and the seller's side has already logged receipt.",
        when: { route: "client_portal", direction: "inverse" },
      },
      // Inverse × Internal — same fact, third-person framing.
      {
        text: "Your solicitor has raised the follow-up enquiries with the seller's side. We've logged it on your purchase. The seller-side had already confirmed receipt, so the two are now in sync.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default × Portal — review-context paragraph.
      {
        text: "After reviewing the initial replies, your solicitor flagged specific points that needed more follow-up. The follow-up round is typically a shorter, more focused list than the initial enquiries, and turnaround is usually faster: 1 to 3 weeks.",
        when: { route: "client_portal", direction: "default" },
      },
      // Default × Internal — review-context paragraph.
      {
        text: "After reviewing the initial replies, your solicitor flagged specific points that needed tightening up. The follow-up round is typically a shorter list and turns around faster: 1 to 3 weeks.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      // Inverse × Portal — sync-and-timing one-liner.
      {
        text: "Both sides are now in sync. Turnaround on the second round is typically faster: 1 to 3 weeks.",
        when: { route: "client_portal", direction: "inverse" },
      },
      // Inverse × Internal — timing-only one-liner.
      {
        text: "Turnaround on the second round is typically faster: 1 to 3 weeks.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: default-direction hand-off nudge to seller ────────────────
  //
  // Fires only when PM17 confirms FIRST (direction = default). In inverse
  // direction VM13 fired first and the nudge belongs on VM13.purchaser.
  vendor: {
    subject: [
      {
        text: "Follow-up enquiries on the way, please confirm receipt, {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Additional enquiries raised", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "Round 2 of enquiries is inbound. The buyer's solicitor has raised them today, and they're heading to your solicitor.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know they've landed, open your portal and tap the highlighted confirm button. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM17 complete: Additional enquiries raised — {address}" },
    ],
    heroLabel: [
      { text: "PM17 — Additional enquiries raised" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed additional enquiries raised." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
