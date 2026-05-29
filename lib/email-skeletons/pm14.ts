// PM14 — Buyer's solicitor has raised initial enquiries to the seller's
// solicitor.
//
// Bilateral natural first-actor in the (PM14, VM10) pair (buyer raises,
// seller receives). PM14's purchaser block is the acted-side (4 variants:
// route × direction). PM14's vendor block is the default-direction hand-
// off nudge only.
//
// Tenure delta on natural-direction acted-side: enquiries-scope list
// includes "the lease and service charges on the leasehold side" on
// leasehold files. Inverse-direction acted-side has no scope paragraph
// at all (tight 2-3 paragraph body).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM14_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement (4 variants) ────────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the initial enquiries have gone out, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Initial enquiries raised on your purchase, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the initial enquiries have gone out, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Initial enquiries raise logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Initial enquiries raised" },
    ],

    opening: [
      {
        text: "Thanks. You've confirmed your solicitor has raised the initial enquiries with the seller's side.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Your solicitor has raised the initial enquiries with the seller's side. We've logged it on your purchase.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. You've confirmed your solicitor has raised the initial enquiries, and the seller's side has already logged receipt on their end.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Your solicitor has raised the initial enquiries with the seller's side. We've logged it on your purchase. The seller's side had already confirmed receipt before this came in, so the two are now in sync.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default direction — enquiries-scope explainer. Freehold.
      {
        text: "Enquiries are the formal questions your solicitor sends after reading the contract pack. They cover anything that needs clarifying about title, planning, what's included in the sale, and anything in the seller's property forms that needs more detail.",
        when: { direction: "default", tenure: "freehold" },
      },
      // Default direction — leasehold variant adds lease + service charges.
      {
        text: "Enquiries are the formal questions your solicitor sends after reading the contract pack. They cover anything that needs clarifying about title, planning, what's included in the sale, the lease and service charges on the leasehold side, and anything in the seller's property forms that needs more detail.",
        when: { direction: "default", tenure: "leasehold" },
      },
      // Inverse direction — no scope paragraph (body collapses).
    ],

    whatNext: [
      // Default × Portal.
      {
        text: "Typical turnaround for the first round is 1 to 4 weeks. Your solicitor will surface anything material once the replies come back.",
        when: { direction: "default", route: "client_portal" },
      },
      // Default × Internal.
      {
        text: "Turnaround for the first round is 1 to 4 weeks. Your solicitor will surface anything material once the replies are back.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse × Portal.
      {
        text: "Both sides are now in sync. The seller's solicitor will work through the questions with the seller. Typical turnaround for the first round is 1 to 4 weeks.",
        when: { direction: "inverse", route: "client_portal" },
      },
      // Inverse × Internal.
      {
        text: "Typical turnaround for the first round is 1 to 4 weeks. Your solicitor will surface anything material once the replies are back.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: default-direction hand-off nudge ──────────────────────────
  vendor: {
    subject: [
      {
        text: "Initial enquiries on the way, please confirm receipt, {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Initial enquiries inbound", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "The buyer's solicitor has raised the initial enquiries, and they're on their way to your solicitor.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know they've landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM14 complete: Initial enquiries raised — {address}" },
    ],
    heroLabel: [
      { text: "PM14 — Initial enquiries raised" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed raising of initial enquiries to the seller's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
