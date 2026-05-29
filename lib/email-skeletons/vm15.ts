// VM15 — Seller's solicitor has issued additional replies to the buyer's
// solicitor.
//
// Bilateral natural FIRST-actor in the (VM15, PM18) pair. Mirror of VM12
// for the follow-up round. Vendor = acted-side (4 variants). Purchaser =
// default-direction hand-off only.
//
// Shape-stable per FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM15_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      {
        text: "You've confirmed the follow-up replies have gone out, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Follow-up replies issued by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the follow-up replies have gone out, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Follow-up replies issuance logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies issued" },
    ],

    opening: [
      {
        text: "Thanks. You've confirmed your solicitor has sent the formal follow-up replies to the buyer's side.",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Your solicitor has issued the follow-up replies to the buyer's side. We've logged it on your sale.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "Thanks. You've confirmed your solicitor sent the follow-up replies, and the buyer's side has already logged receipt.",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Your solicitor has issued the follow-up replies. We've logged it on your sale, ahead of the buyer-side having logged receipt.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [],

    whatNext: [
      {
        text: "The buyer's solicitor will review them and conclude where the enquiry side of the file lands. Typically faster than the first round because there are fewer points to consider.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "The buyer's solicitor will review them and conclude where the enquiry side of the file lands. Typically faster than the first round.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      {
        text: "Both sides are in sync. The buyer's solicitor will review and conclude on the enquiry side of the file.",
        when: { direction: "inverse", route: "client_portal" },
      },
      {
        text: "The buyer's solicitor will review and conclude on the enquiry side of the file.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      {
        text: "Follow-up replies on the way to your solicitor, {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Follow-up replies inbound", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "The follow-up replies are on their way to your solicitor, issued by the seller's side today.",
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
      { text: "VM15 complete: Follow-up replies issued — {address}" },
    ],
    heroLabel: [
      { text: "VM15 — Follow-up replies issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed issuing follow-up replies to the buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
