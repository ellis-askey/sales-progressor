// VM7 — Seller's solicitor has issued the draft contract pack.
//
// Bilateral milestone. VM7 is the natural first-actor in the (VM7, PM7)
// pair. The vendor (acted side) gets four variants — route (portal /
// internal) × direction (default / inverse). The purchaser gets the
// default-direction hand-off nudge only; in inverse direction PM7 fired
// first and the nudge belongs there.
//
// Tenure conditioning sits on the pack-composition paragraphs (TA7 and
// management pack added on leasehold). PurchaseType doesn't condition
// VM7 — funding only enters the story on the buyer's side, and even
// there it's deferred to PM7's ack.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM7_SKELETON: MilestoneSkeleton = {

  // ── Vendor: acted-side acknowledgement (4 variants) ───────────────────
  vendor: {
    subject: [
      {
        text: "You've confirmed the contract pack has gone out, {address}",
        when: { route: "client_portal", direction: "default" },
      },
      {
        text: "Contract pack issued to the buyer's side, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      {
        text: "You've confirmed the contract pack went out, {address}",
        when: { route: "client_portal", direction: "inverse" },
      },
      {
        text: "Contract pack issuance logged, {address}",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Contract pack issued" },
    ],

    opening: [
      // Default × Portal.
      {
        text: "Thanks. You've confirmed that your solicitor's sent the draft contract pack across to the buyer's side.",
        when: { route: "client_portal", direction: "default" },
      },
      // Default × Internal.
      {
        text: "The draft contract pack has gone across to the buyer's solicitor. We've logged it on your sale.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "default" },
      },
      // Inverse × Portal — the buyer side already logged receipt.
      {
        text: "Thanks. You've confirmed your solicitor sent the contract pack across, and the buyer's side has already logged receipt on their end.",
        when: { route: "client_portal", direction: "inverse" },
      },
      // Inverse × Internal — same fact, third-person framing.
      {
        text: "The draft contract pack has been issued by your solicitor. We've logged it on your sale. The buyer's side had already confirmed receipt before this came in, so the two are now in sync.",
        when: { route: { in: ["agent", "sales_progressor"] }, direction: "inverse" },
      },
    ],

    whatHappened: [
      // Default direction — full pack-composition explainer. Freehold.
      {
        text: "The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, and the property information forms you completed (TA6 and TA10).",
        when: { direction: "default", tenure: "freehold" },
      },
      // Default direction — leasehold variant adds TA7 and management pack.
      {
        text: "The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, the title documents, the property information forms you completed (TA6, TA10, and TA7), and the management pack from your freeholder once that's in.",
        when: { direction: "default", tenure: "leasehold" },
      },
      // Inverse × Portal — abbreviated pack-composition paragraph. Freehold.
      {
        text: "The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, and the property forms you completed.",
        when: { direction: "inverse", route: "client_portal", tenure: "freehold" },
      },
      // Inverse × Portal — leasehold variant mentions management pack.
      {
        text: "The contract pack is the bundle that forms the legal foundation of the sale: the draft contract, title documents, the property forms you completed, and the management pack from your freeholder.",
        when: { direction: "inverse", route: "client_portal", tenure: "leasehold" },
      },
      // Inverse × Internal — no pack-composition paragraph at all (the
      // body stays at 2 paragraphs: opening + next-steps).
    ],

    whatNext: [
      // Default direction — full "enquiries follow in 1–2 weeks" framing.
      {
        text: "The buyer's solicitor will now review everything and raise enquiries about anything they want clarified. Their first round typically lands with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.",
        when: { direction: "default", route: "client_portal" },
      },
      {
        text: "The buyer's solicitor will now review everything and raise enquiries with your solicitor within a week or two. Your solicitor will handle the formal back-and-forth and come to you on any specific point that needs your read.",
        when: { direction: "default", route: { in: ["agent", "sales_progressor"] } },
      },
      // Inverse direction — single shared next-steps paragraph across
      // both routes (the buyer's solicitor is already reviewing).
      {
        text: "Because the buyer's solicitor already has it, they'll be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.",
        when: { direction: "inverse", route: "client_portal" },
      },
      {
        text: "The buyer's solicitor will be starting their review now. Their first round of enquiries typically lands with your solicitor within a week or two.",
        when: { direction: "inverse", route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: default-direction hand-off nudge ───────────────────────
  //
  // Fires only when VM7 confirms FIRST (direction = default). In inverse
  // direction PM7 fired first and the nudge belongs on PM7's vendor block.
  // No tenure or funding conditioning on the FINAL hand-off — kept slim
  // on purpose; the substantive content lives in PM7's acted-side ack.
  purchaser: {
    subject: [
      {
        text: "Contract pack on its way to your solicitor, {address}",
        when: { direction: "default" },
      },
    ],

    heroLabel: [
      { text: "Contract pack in transit", when: { direction: "default" } },
    ],

    opening: [
      {
        text: "The draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.",
        when: { direction: "default" },
      },
    ],

    whatHappened: [
      {
        text: "When your solicitor lets you know it's landed, open your portal and tap the highlighted confirm button. That logs receipt on the file and triggers the next steps. Takes about ten seconds.",
        when: { direction: "default" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "default" } },
    ],
  },

  // ── Progressor: internal log (preserved unchanged) ────────────────────
  progressor: {
    subject: [
      { text: "VM7 complete: Contract pack issued — {address}" },
    ],
    heroLabel: [
      { text: "VM7 — Draft contract pack issued" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Seller's solicitor has confirmed issue of draft contract pack to buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
