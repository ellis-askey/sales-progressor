// PM18 — Buyer's solicitor has received additional replies.
//
// Bilateral natural SECOND-actor in the (VM15, PM18) pair. Mirror of
// PM15 for the follow-up round. Purchaser = acted-side (4 variants).
// Vendor = inverse-direction hand-off only.
//
// Shape-stable per FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM18_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      {
        text: "You've confirmed the follow-up replies have arrived, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Follow-up replies received by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the follow-up replies have arrived, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Follow-up replies receipt logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies received" },
    ],

    opening: [
      {
        text: "Thanks. The seller's follow-up replies are now with your solicitor.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "The seller's follow-up replies have landed with your solicitor. We've logged it on your purchase.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. The seller's follow-up replies are now with your solicitor, ahead of the seller's side confirming the issuance.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "The seller's follow-up replies have landed with your solicitor. We've logged it on your purchase, ahead of the seller's side confirming the issuance.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [],

    whatNext: [
      {
        text: "Your solicitor will work through them and let you know what they conclude. Typically faster than the initial review since there are fewer points to consider.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "Your solicitor will work through them and let you know what they conclude. Typically faster than the initial review.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      {
        text: "Your solicitor will work through the follow-up replies and let you know what they conclude. Typically faster than the initial review.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      {
        text: "Buyer's side has confirmed receipt of the follow-up replies, {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Buyer has the follow-up replies", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The buyer's side has logged receipt of the follow-up replies ahead of your side confirming they went out.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor confirms the issuance, open your portal and tap the highlighted confirm button to bring the two in sync.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  progressor: {
    subject: [
      { text: "PM18 complete: Follow-up replies received — {address}" },
    ],
    heroLabel: [
      { text: "PM18 — Follow-up replies received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of follow-up replies from the seller's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
