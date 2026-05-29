// VM9 — Seller's solicitor has received the management pack.
//
// Leasehold-only milestone (auto-NR'd on freehold). Middle event in the
// three-step management-pack arc.
//
// Per FINAL: vendor only — no purchaser email fires for VM9. The buyer
// is informed at PM12 (when their solicitor receives the pack), so VM9
// purchaser would be redundant.
//
// Source: FINAL email matrix.

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

  // No purchaser block per FINAL — VM9 fires to vendor only.

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
