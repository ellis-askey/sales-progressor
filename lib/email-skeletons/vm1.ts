// VM1 — Seller has instructed their solicitor.
//
// Universal first step on the seller side. No bilateral pair — single
// "milestone confirmed" fan-out. Shape relevance: vendor's "what comes
// next" mentions the management pack only on leasehold (existing copy
// hedged with "if the property is leasehold"; this skeleton drops the
// hedge and fires the line only on leasehold files).
//
// Recipients: vendor + purchaser + progressor. No vendorAgent (matches
// existing portal-copy.ts entry — VM1 has no vendorAgent variant today).
// No route/direction conditioning — this is not a bilateral milestone.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM1_SKELETON: MilestoneSkeleton = {

  // ── Vendor: the seller who just instructed their solicitor ────────────
  vendor: {
    subject: [
      { text: "You've instructed your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Solicitor instructed" },
    ],
    opening: [
      { text: "You've taken the first step." },
    ],
    whatHappened: [
      {
        text: "You've formally instructed your solicitor to act on the sale. They'll now start the conveyancing process — preparing the contract pack, gathering title documents, and handling any questions that come in from the buyer's solicitor.",
      },
    ],
    whatNext: [
      // Universal forward-look.
      {
        text: "Your solicitor will prepare the contract pack over the coming weeks. The file moves on its own clock from here until the next meaningful event on your side.",
      },
      // Leasehold addendum — replaces the existing "if the property is
      // leasehold" hedge with a direct statement that fires only when
      // tenure actually is leasehold. Opens "On a leasehold sale…" so
      // the cadence stays consistent with other shape-conditional
      // paragraphs across the matrix.
      {
        text: "The management pack from your freeholder or managing agent is the next leasehold-specific piece in flight — your solicitor will be requesting it around now, and those packs typically take several weeks to come back on their own clock.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: buyer hearing the seller's side has kicked off ─────────
  purchaser: {
    subject: [
      { text: "The seller has instructed their solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Seller's solicitor instructed" },
    ],
    opening: [
      { text: "The seller's solicitor is in place." },
    ],
    whatHappened: [
      {
        text: "The seller has formally instructed their solicitor to act on the sale. This is an important early step — things are now moving on the seller's side of the transaction.",
      },
    ],
    whatNext: [
      // Universal.
      {
        text: "Nothing for you to do right now. The seller's solicitor will prepare the contract pack and send it to your solicitor in the coming weeks.",
      },
      // Leasehold note — the buyer should know the leasehold pack is a
      // separate piece that can slow things down, so the wait isn't a
      // surprise. Fires only on leasehold.
      {
        text: "While the seller's solicitor gets started, they'll also need to request a management pack from the freeholder — that piece often takes several weeks to come back on its own clock and is a common cause of delay in leasehold transactions.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log, shape-stable ────────────────────────────
  progressor: {
    subject: [
      { text: "VM1 complete: Seller instructed solicitor — {address}" },
    ],
    heroLabel: [
      { text: "VM1 — Seller instructed solicitor" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed solicitor instruction." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
