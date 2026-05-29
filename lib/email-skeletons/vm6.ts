// VM6 — Seller has returned completed property information forms.
//
// Non-bilateral, no route/direction conditioning. Vendor branches on
// tenure (leasehold rewrites both body paragraphs around the management
// pack as the remaining gating piece). Purchaser branches on tenure
// (leasehold adds the "may be waiting on the management pack" clause).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM6_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Property forms returned to your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Property forms returned" },
    ],
    opening: [
      // Freehold — straightforward fold-in framing.
      {
        text: "Your completed property information forms are back with your solicitor. They'll now fold them into the contract pack alongside the title documents.",
        when: { tenure: "freehold" },
      },
      // Leasehold — mentions the management pack as part of the fold-in.
      {
        text: "Your completed property information forms are back with your solicitor. They'll now fold them into the contract pack alongside the title documents and (once it lands) the management pack from your freeholder.",
        when: { tenure: "leasehold" },
      },
    ],
    whatHappened: [
      // Freehold — contract pack goes once forms returned.
      {
        text: "Once everything's assembled, the contract pack goes across to the buyer's solicitor, and the substantive review on their side begins.",
        when: { tenure: "freehold" },
      },
      // Leasehold — management pack as the gating piece.
      {
        text: "The contract pack goes to the buyer's solicitor once everything's in. If the management pack hasn't arrived yet, that's likely to be the remaining piece holding the contract pack back. A polite nudge to your freeholder this week is worth doing if you haven't already.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "The seller has returned their property information forms, {address}" },
    ],
    heroLabel: [
      { text: "Property forms returned" },
    ],
    opening: [
      { text: "The seller has returned their completed property information forms to their solicitor. Those will be included in the contract pack that comes to your solicitor." },
    ],
    whatHappened: [
      // Freehold — clean handoff, no extra wait described.
      {
        text: "Nothing to do from your side right now. The seller's solicitor will finalise the contract pack and send it across shortly.",
        when: { tenure: "freehold" },
      },
      // Leasehold — adds the "may be waiting on the management pack" clause.
      {
        text: "Nothing to do from your side right now. The seller's solicitor will finalise the contract pack and send it across, though on a leasehold sale they may be waiting on the management pack from the freeholder before they can send everything together.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM6 complete: Seller returned property forms — {address}" },
    ],
    heroLabel: [
      { text: "VM6 — Seller returned property forms" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed return of completed property information forms to solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
