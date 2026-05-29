// VM13 — Seller's solicitor has received additional enquiries.
//
// Bilateral natural SECOND-actor in the (PM17, VM13) pair. VM13's vendor
// block is the acted-side (4 variants: route × direction). VM13's
// purchaser block is the inverse-direction hand-off nudge only.
//
// Shape-stable per FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM13_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      {
        text: "You've confirmed the follow-up enquiries have landed, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Buyer's follow-up enquiries received by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the follow-up enquiries have landed, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Buyer's follow-up enquiries receipt logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Follow-up enquiries received" },
    ],

    opening: [
      {
        text: "Thanks. Your solicitor now has the buyer's follow-up enquiries.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "The follow-up enquiries are now with your solicitor. We've logged it on your sale.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. Your solicitor now has the buyer's follow-up enquiries, ahead of the buyer's side confirming the raise.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "The follow-up enquiries are now with your solicitor. We've logged it on your sale, ahead of the buyer's side confirming the raise.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "These are the buyer's solicitor's follow-up questions after working through the initial replies. Typically a shorter list focused on specific points the first round didn't fully close out.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "These are the buyer's solicitor's follow-up questions after working through the initial replies. Typically a shorter, more focused list.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse — no scope paragraph.
    ],

    whatNext: [
      {
        text: "Your solicitor will work through them and come to you if any need fresh input. Turnaround on follow-up rounds is usually faster than the first, so this should move more quickly.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "Your solicitor will work through them and come to you if any need fresh input.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      {
        text: "Your solicitor will work through the follow-up questions with you. Turnaround on the second round is typically faster: 1 to 3 weeks.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      {
        text: "Seller's side has confirmed receipt of the follow-ups, {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Seller has the follow-ups", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The seller's side has logged receipt of the follow-up enquiries ahead of your side confirming they went out.",
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
      { text: "VM13 complete: Follow-up enquiries received — {address}" },
    ],
    heroLabel: [
      { text: "VM13 — Follow-up enquiries received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed receipt of follow-up enquiries from the buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
