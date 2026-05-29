// VM8 — Seller's solicitor has requested the management pack.
//
// Leasehold-only milestone (auto-NR'd on freehold in lib/milestone-auto-nr.ts).
// First step in the three-event management-pack arc.
//
// Source: FINAL email matrix (leasehold-cash_buyer journey).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM8_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Management pack requested from your freeholder, {address}" },
    ],
    heroLabel: [
      { text: "Management pack requested" },
    ],
    opening: [
      { text: "Your solicitor has formally requested the management pack from your freeholder (or managing agent)." },
    ],
    whatHappened: [
      {
        text: "It's the bundle the buyer's side needs to review the leasehold side of the sale: the lease itself, service charge accounts, ground rent, building insurance, planned major works, and any disputes or arrears on the building.",
      },
    ],
    whatNext: [
      {
        text: "Freeholders or managing agents typically take 2 to 6 weeks to send the pack across, and most charge a fee for compiling it (often £200 to £500, sometimes more). This is one of the most common places things slow down on a leasehold sale. If you have an existing relationship with your freeholder or managing agent, a polite follow-up call from you a couple of weeks in often helps move it along.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's solicitor has requested the management pack, {address}" },
    ],
    heroLabel: [
      { text: "Management pack requested" },
    ],
    opening: [
      { text: "The seller's solicitor has written to the freeholder for the management pack." },
    ],
    whatHappened: [
      {
        text: "That's the bundle your solicitor needs to review the leasehold side of the property: the lease, service charges, ground rent, building insurance, planned works, and any disputes on the building.",
      },
    ],
    whatNext: [
      {
        text: "The freeholder typically takes 2 to 6 weeks to send the pack back to the seller's solicitor. Once it's with them, they'll forward it to your solicitor to review. Nothing for you to do right now, but this is often the slowest piece on a leasehold sale.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM8 complete: Management pack requested — {address}" },
    ],
    heroLabel: [
      { text: "VM8 — Management pack requested" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has formally requested the management pack from the freeholder/managing agent." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
