// VM10 — Seller's solicitor has received initial enquiries.
//
// Bilateral natural SECOND-actor in the (PM14, VM10) pair. VM10's vendor
// block is the acted-side (4 variants: route × direction). VM10's purchaser
// block is the inverse-direction hand-off nudge only.
//
// Tenure delta on acted-side: enquiries-scope list includes "the lease
// and service charges" on leasehold files.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM10_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement (4 variants) ───────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed your solicitor has the enquiries, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Buyer's enquiries received by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed your solicitor has the enquiries, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Buyer's enquiries receipt logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Enquiries received" },
    ],

    opening: [
      {
        text: "Thanks. You've confirmed the initial enquiries are with your solicitor, landed from the buyer's side.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Your solicitor has received the initial enquiries from the buyer's solicitor. We've logged it on your sale.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. You've confirmed the initial enquiries are with your solicitor, ahead of the buyer's side confirming they went out. Both sides are now in sync.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Your solicitor has received the initial enquiries from the buyer's solicitor. We've logged it on your sale, ahead of the buyer's side confirming the issuance.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default direction — enquiries-scope explainer. Freehold.
      {
        text: "Enquiries are the formal questions the buyer's solicitor raises after reading the contract pack. They cover anything that needs clarifying about title, planning, what's included in the sale, and anything in your property forms that needs more detail. They're a normal part of every conveyancing process, not a sign anything's wrong.",
        when: { direction: "default", route: "client_portal", tenure: "freehold" },
      },
      // Default × Portal × Leasehold — adds lease and service charges.
      {
        text: "Enquiries are the formal questions the buyer's solicitor raises after reading the contract pack. They cover anything that needs clarifying about title, planning, what's included in the sale, the lease and service charges, and anything in your property forms that needs more detail. They're a normal part of every conveyancing process, not a sign anything's wrong.",
        when: { direction: "default", route: "client_portal", tenure: "leasehold" },
      },
      // Default × Internal × Freehold — shorter scope paragraph.
      {
        text: "Enquiries are the formal questions the buyer's solicitor raises after reading the contract pack. They cover title, planning, what's included in the sale, and anything in your property forms that needs more detail. They're a normal part of every conveyancing process.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] }, tenure: "freehold" },
      },
      // Default × Internal × Leasehold.
      {
        text: "Enquiries are the formal questions the buyer's solicitor raises after reading the contract pack. They cover title, planning, what's included in the sale, the lease and service charges, and anything in your property forms that needs more detail. They're a normal part of every conveyancing process.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] }, tenure: "leasehold" },
      },
      // Inverse direction — no scope paragraph.
    ],

    whatNext: [
      // Default × Portal — "come to you for input" framing.
      {
        text: "Your solicitor will work through the list and come to you for input on points only you can answer: works you've had done, neighbour relationships, planning consents you've used, anything where the property's history matters. Try to respond promptly when they reach out. The file moves at the speed of these answers.",
        when: { direction: "default", route: "client_portal" },
      },
      // Default × Internal — shorter version.
      {
        text: "Your solicitor will work through the list and come to you for input on points only you can answer. Try to respond promptly when they do. The file moves at the speed of these answers.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse direction — brief next-steps line shared across routes.
      {
        text: "Your solicitor will work through the questions with you. Typical turnaround for the first round is 1 to 4 weeks.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: inverse-direction hand-off nudge ───────────────────────
  purchaser: {
    subject: [
      {
        text: "Seller's side has confirmed receipt of the enquiries, {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Seller has the enquiries", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The seller's side has logged receipt of your solicitor's initial enquiries, ahead of your side confirming they went out.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor confirms the issuance to you, open your portal and tap the highlighted confirm button to bring the two in sync. Takes about ten seconds.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM10 complete: Initial enquiries received — {address}" },
    ],
    heroLabel: [
      { text: "VM10 — Initial enquiries received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed receipt of initial enquiries from the buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
