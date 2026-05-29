// PM16 — Buyer's solicitor has reviewed the initial replies.
//
// Unilateral buyer-side closing event of Phase 10. Purchaser only.
// Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM16_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor has reviewed the seller's replies, {address}" },
    ],
    heroLabel: [
      { text: "Replies reviewed" },
    ],
    opening: [
      { text: "Your solicitor has finished reviewing the seller's replies." },
    ],
    whatHappened: [
      {
        text: "A review of this kind usually lands in one of three places. Either the replies satisfied everything and your solicitor's comfortable to move the file forward, or some points need follow-up and additional enquiries will be raised, or something material has surfaced that warrants a conversation with you before deciding how to proceed.",
      },
    ],
    whatNext: [
      {
        text: "Your solicitor will be in touch about which applies to your file. If it's all clear, the file moves to the next stage. If follow-up enquiries are needed, expect that to add a couple of weeks to the timeline. If a material concern has surfaced, your solicitor will walk you through what they've found and what your options are.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor block per FINAL — PM16 fires to purchaser only.

  progressor: {
    subject: [
      { text: "PM16 complete: Initial replies reviewed — {address}" },
    ],
    heroLabel: [
      { text: "PM16 — Initial replies reviewed" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed reviewing the seller's initial replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
