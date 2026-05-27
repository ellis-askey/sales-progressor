// VM9 — Seller's solicitor has received the management pack.
//
// Leasehold-only milestone (auto-NR'd on freehold). Middle event in the
// three-step management-pack arc — VM8 (requested) → VM9 (received by
// seller) → PM12 (received by buyer). VM8 owns the "what is a management
// pack" explainer; VM9 refers to "the pack" without re-explaining.
//
// Seller-side: positive — a known bottleneck has cleared.
// Buyer-side: heads-up that the pack is now on its way across to their
// solicitor. The actual "your solicitor has it" moment is PM12, fired
// when the buyer's side acknowledges receipt — keeps VM9's buyer body
// distinct from PM12's.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM9_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Management pack has arrived — {address}" },
    ],
    heroLabel: [
      { text: "Management pack in" },
    ],
    opening: [
      { text: "The management pack is back from the freeholder." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has now received the management pack and will fold it into the contract pack going across to the buyer's side. That's typically the slowest piece on a leasehold sale, so getting it back is meaningful progress.",
      },
    ],
    whatNext: [
      // Just the forward event — "expect enquiries" framing is PM12's
      // job (fires 1–3 days later when the buyer's side acknowledges
      // receipt). Letting both bodies set the enquiry expectation would
      // duplicate the same forward-look to the seller in adjacent emails.
      {
        text: "Your solicitor will forward the pack across to the buyer's solicitor in the next day or two. The next milestone on this trail is the buyer's side confirming receipt.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Management pack is back on the seller's side — {address}" },
    ],
    heroLabel: [
      { text: "Management pack received by seller" },
    ],
    opening: [
      // Distinct from VM8 purchaser's "Update on the leasehold side"
      // opening — on dense LL files the buyer reads VM8 and VM9 a few
      // weeks apart and identical opening lines would read as a stamped
      // template. This one names the event in the opening.
      { text: "Movement on the management pack." },
    ],
    whatHappened: [
      {
        text: "The seller's solicitor has now received the management pack from the freeholder. That's the leasehold bottleneck cleared on their side.",
      },
    ],
    whatNext: [
      {
        text: "The seller's solicitor will send the pack across to your solicitor over the next day or two.",
      },
    ],
    action: [
      { text: "View your portal" },
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
