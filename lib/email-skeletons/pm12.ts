// PM12 — Buyer's solicitor has received the management pack from the
// vendor's solicitor.
//
// Leasehold-only milestone (auto-NR'd on freehold). Final step in the
// three-event management-pack arc.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM12_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's solicitor has the management pack, {address}" },
    ],
    heroLabel: [
      { text: "Buyer has the management pack" },
    ],
    opening: [
      { text: "The buyer's solicitor now has the management pack. That's the complete leasehold picture across to their side." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "They'll review it alongside the rest of the contract pack and raise enquiries with your solicitor on anything that needs clarifying. Leasehold enquiries often focus on service charges, ground rent, planned major works, and the terms of the lease, so expect those areas to come up.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Management pack received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Management pack received" },
    ],
    opening: [
      { text: "Your solicitor now has the management pack. With the contract pack and the management pack both in, they have everything they need to do the full review of the leasehold side of the purchase." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Expect enquiries to go across to the seller's solicitor over the next week or two, especially on service charges, ground rent, any planned major works, and the lease terms themselves. Your solicitor will surface anything material once they've worked through it.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM12 complete: Management pack received by buyer — {address}" },
    ],
    heroLabel: [
      { text: "PM12 — Management pack received by buyer" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of the management pack from the vendor's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
