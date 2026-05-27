// VM8 — Seller's solicitor has requested the management pack.
//
// Leasehold-only milestone (auto-NR'd on freehold in lib/milestone-auto-nr.ts).
// Because the milestone is suppressed on freehold files, the skeleton
// doesn't need tenure conditioning inside the bodies — every reader of
// this email is on a leasehold sale by definition. Funding shape is
// irrelevant for the management pack process; the pack concerns the
// property and the lease, not the buyer's funding. Non-bilateral.
//
// This is the first of three management-pack milestones (VM8 → VM9 →
// PM12). VM8 owns the "what is a management pack" explainer; VM9 and
// PM12 refer to "the pack" without re-explaining, to keep the sequence
// reading like a narrative arc rather than three takes on the same
// summary. This is the same paired-read discipline that drove the VM7
// slim, applied across a non-bilateral trio.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM8_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Management pack requested from your freeholder — {address}" },
    ],
    heroLabel: [
      { text: "Management pack requested" },
    ],
    opening: [
      { text: "Your solicitor has requested the management pack." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has formally written to your freeholder (or managing agent) requesting the management pack — the bundle the buyer's side needs to review the leasehold side of the sale. It typically covers the lease itself, service charge accounts, ground rent, building insurance, any planned major works, and any disputes or arrears on the building.",
      },
    ],
    whatNext: [
      {
        text: "Freeholders or managing agents usually take 2–6 weeks to send the pack across, and most charge a fee for compiling it (often £200–£500, sometimes more). On a leasehold sale this is one of the most common places things slow down — if you have an existing relationship with your freeholder or managing agent, a polite follow-up call from you a couple of weeks in often helps move it along.",
      },
      {
        text: "Your solicitor will fold the pack into the contract pack as soon as it arrives. If you've already had to pay a fee directly, let your solicitor know — the cost is often passed on to the buyer or factored into the sale.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's solicitor has requested the management pack — {address}" },
    ],
    heroLabel: [
      { text: "Management pack requested" },
    ],
    opening: [
      { text: "The seller's solicitor has written to the freeholder for the management pack." },
    ],
    whatHappened: [
      {
        text: "The seller's solicitor has written to the freeholder (or managing agent) to request the management pack — the bundle your solicitor needs to review the leasehold side of the property. It covers the lease itself, service charges, ground rent, building insurance, planned works, and any disputes on the building.",
      },
    ],
    whatNext: [
      {
        text: "The freeholder typically takes 2–6 weeks to send the pack back to the seller's solicitor. Once it's with them, they'll forward it to your solicitor to review. There's nothing for you to do right now — but this is often the slowest piece on a leasehold sale, so it's worth knowing it's now in flight.",
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
      { text: "Vendor solicitor has confirmed request for management pack from freeholder/managing agent." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
