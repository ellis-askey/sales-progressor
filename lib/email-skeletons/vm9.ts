// VM9 — Seller's solicitor has received the management pack.
//
// Leasehold-only milestone (auto-NR'd on freehold). Middle event in the
// three-step management-pack arc.
//
// Job B addition (2026-05-29): adds a purchaser block (leasehold-gated)
// telling the buyer the freeholder's management pack has landed seller-
// side and is on its way through to their solicitor. Phase 7 is already
// auto-NR on freehold (lib/milestone-auto-nr.ts), so the tenure gate is
// defensive but kept in case the auto-NR logic ever changes.
//
// Source: FINAL email matrix; purchaser block from three-new-counterpart-
// emails.md.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM9_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Management pack received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Management pack in" },
    ],
    opening: [
      { text: "The management pack from your freeholder has landed with your solicitor. That clears one of the slowest pieces on a leasehold sale." },
    ],
    whatNext: [
      {
        text: "Your solicitor will now fold it into the contract pack and forward to the buyer's solicitor for review. From here, the file moves at the pace of the buyer's solicitor working through the full pack and raising enquiries.",
      },
    ],
    whatHappened: [],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      {
        text: "Management pack received seller-side, {address}",
        when: { tenure: "leasehold" },
      },
    ],
    heroLabel: [
      { text: "Management pack seller-side", when: { tenure: "leasehold" } },
    ],
    opening: [
      {
        text: "Movement on the leasehold side. The management pack from the freeholder has landed with the seller's solicitor.",
        when: { tenure: "leasehold" },
      },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "That clears one of the slowest pieces on a leasehold sale. The seller's solicitor will now fold it into the contract pack and forward to your solicitor for review. Nothing for you to do right now. We'll be in touch again once your solicitor confirms receipt in the coming days.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal", when: { tenure: "leasehold" } },
    ],
  },

  progressor: {
    subject: [
      { text: "VM9 complete: Management pack received — {address}" },
    ],
    heroLabel: [
      { text: "VM9 — Management pack received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed receipt of management pack from freeholder/managing agent." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
