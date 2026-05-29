// PM7 — Buyer's solicitor has received the draft contract pack.
//
// Bilateral milestone, counterpart to VM7. PM7 is the natural second-actor
// in the (VM7, PM7) pair. The purchaser (acted side) gets four variants —
// route (portal / internal) × direction (default / inverse). The vendor
// gets the inverse-direction hand-off nudge only; in default direction
// VM7 fired its own vendor ack and no nudge is needed.
//
// Tenure conditioning sits on the pack-composition paragraph (management
// pack added on leasehold). PurchaseType conditioning is on the closing
// "what's in flight in parallel" paragraph — three branches, one per
// purchaseType.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM7_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement (4 variants) ────────────────
  purchaser: {
    subject: [
      {
        text: "You've confirmed the contract pack has arrived, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Contract pack received by your solicitor, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the contract pack has arrived, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Contract pack receipt logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Contract pack received" },
    ],

    opening: [
      // Default × Portal.
      {
        text: "Thanks. You've confirmed your solicitor has the draft contract pack from the seller's side.",
        when: { route: "client_portal", direction: "default" },
      },
      // Default × Internal.
      {
        text: "Your solicitor now has the draft contract pack from the seller's solicitor. We've logged it on your purchase.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      // Inverse × Portal.
      {
        text: "Thanks. You've confirmed your solicitor has the contract pack from the seller's side, ahead of the seller's confirmation that it went out. Both sides are now in sync on the file.",
        when: { route: "client_portal", direction: "inverse" },
      },
      // Inverse × Internal.
      {
        text: "Your solicitor has the contract pack from the seller's side. We've logged it on your purchase, ahead of the seller's side logging that it went out.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default direction — pack-composition paragraph fires. Freehold.
      {
        text: "That's the bundle of documents that forms the legal foundation of your purchase: the draft contract, title documents, and the seller's property information forms.",
        when: { direction: "default", tenure: "freehold" },
      },
      // Default direction — leasehold variant adds management pack.
      {
        text: "That's the bundle of documents that forms the legal foundation of your purchase: the draft contract, title documents, the seller's property information forms, and the management pack from the freeholder.",
        when: { direction: "default", tenure: "leasehold" },
      },
      // Inverse direction — no pack-composition paragraph at all. The
      // body collapses to opening + whatNext.
    ],

    whatNext: [
      // Default × Portal × cash_buyer.
      {
        text: "Your solicitor will now review everything carefully and raise enquiries with the seller's solicitor over the next week or two. While that's in flight, your survey is the other big piece worth keeping moving in parallel.",
        when: { direction: "default", route: "client_portal", purchaseType: "cash_buyer" },
      },
      // Default × Portal × mortgage.
      {
        text: "Your solicitor will now review everything carefully and raise enquiries with the seller's solicitor over the next week or two. While that's in flight, keep your mortgage application and your survey progressing in parallel. Both want to be moving while your solicitor works through the pack.",
        when: { direction: "default", route: "client_portal", purchaseType: "mortgage" },
      },
      // Default × Portal × cash_from_proceeds.
      {
        text: "Your solicitor will now review everything carefully and raise enquiries with the seller's solicitor over the next week or two. While that's in flight, your survey is the other big piece worth keeping moving in parallel.\n\nA reminder on your related sale: it has to exchange before this purchase can. Keep us posted on how it's progressing.",
        when: { direction: "default", route: "client_portal", purchaseType: "cash_from_proceeds" },
      },
      // Default × Internal × cash_buyer.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] }, purchaseType: "cash_buyer" },
      },
      // Default × Internal × mortgage.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your mortgage application and your survey progressing in parallel while that's in flight.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] }, purchaseType: "mortgage" },
      },
      // Default × Internal × cash_from_proceeds.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel. And on your related sale: it has to exchange before this purchase can, so keep us posted on how that's moving.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] }, purchaseType: "cash_from_proceeds" },
      },
      // Inverse × Portal × cash_buyer.
      {
        text: "Your solicitor will review the pack carefully and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel.",
        when: { direction: "inverse", route: "client_portal", purchaseType: "cash_buyer" },
      },
      // Inverse × Portal × mortgage.
      {
        text: "Your solicitor will review the pack carefully and raise enquiries with the seller's solicitor over the next week or two. Keep your mortgage application and your survey progressing in parallel.",
        when: { direction: "inverse", route: "client_portal", purchaseType: "mortgage" },
      },
      // Inverse × Portal × cash_from_proceeds.
      {
        text: "Your solicitor will review the pack carefully and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel, and keep us posted on your related sale, which has to exchange before this purchase can.",
        when: { direction: "inverse", route: "client_portal", purchaseType: "cash_from_proceeds" },
      },
      // Inverse × Internal × cash_buyer.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] }, purchaseType: "cash_buyer" },
      },
      // Inverse × Internal × mortgage.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your mortgage application and your survey progressing in parallel.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] }, purchaseType: "mortgage" },
      },
      // Inverse × Internal × cash_from_proceeds.
      {
        text: "Your solicitor will now review everything and raise enquiries with the seller's solicitor over the next week or two. Keep your survey progressing in parallel, and keep us posted on your related sale, which has to exchange before this purchase can.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] }, purchaseType: "cash_from_proceeds" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: inverse-direction hand-off nudge ──────────────────────────
  //
  // Fires only when PM7 confirms BEFORE VM7. Direction-stable: shape-
  // agnostic body — no tenure or purchaseType conditioning per FINAL.
  vendor: {
    subject: [
      {
        text: "Buyer's side has confirmed receipt of the contract pack, {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Contract pack received by buyer", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The buyer's side has logged receipt of the contract pack ahead of your side confirming it was issued.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "When you've spoken to your solicitor and they've confirmed it's gone out, open your portal and tap the highlighted confirm button to bring the two in sync. Takes about ten seconds.",
        when: { direction: "inverse" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  // ── Progressor: internal log (preserved unchanged) ────────────────────
  progressor: {
    subject: [
      { text: "PM7 complete: Contract pack received — {address}" },
    ],
    heroLabel: [
      { text: "PM7 — Draft contract pack received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of draft contract pack." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
