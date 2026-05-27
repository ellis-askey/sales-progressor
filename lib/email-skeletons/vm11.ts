// VM11 — Seller has provided initial replies to their solicitor.
//
// Non-bilateral, internal seller-side step between VM10 (enquiries
// received) and VM12 (replies issued to buyer's side). The seller has
// done their part — answered the questions their solicitor put to them
// — and now the solicitor will compile the formal response.
//
// Cross-milestone discipline: VM10 already explained what enquiries are
// and that the seller would be asked for input. VM12 will cover the
// "replies sent across" moment. This body's distinct beat is "your
// work on this is done; your solicitor is now writing it up formally."
// Short and focused.
//
// Buyer-side: a heads-up that the seller has provided their input.
// Buyer's solicitor doesn't yet have the formal replies — that's VM12.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM11_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Replies to enquiries — your part is done — {address}" },
    ],
    heroLabel: [
      { text: "Replies provided to solicitor" },
    ],
    opening: [
      { text: "That's your part of the enquiry response done — your input's now with your solicitor for the formal replies." },
    ],
    whatHappened: [
      // Trimmed: opening now carries "your part done" + "input with
      // solicitor"; whatHappened restated both. Dropped the restatement
      // sentence; kept the substance about what kind of answers were
      // provided.
      {
        text: "The answers and information you sent across cover the points the buyer's solicitor raised in the first round of enquiries.",
      },
    ],
    whatNext: [
      {
        text: "Your solicitor will now compile your input into the formal written replies and send them across to the buyer's solicitor — typically within a few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller has provided their input on the enquiries — {address}" },
    ],
    heroLabel: [
      { text: "Seller's replies in progress" },
    ],
    opening: [
      { text: "Movement on the enquiries." },
    ],
    whatHappened: [
      {
        text: "The seller has provided their input to their solicitor on the initial enquiries. Their solicitor will now compile the formal written replies and send them across to your solicitor.",
      },
    ],
    whatNext: [
      {
        text: "Expect the replies to land with your solicitor in the next few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM11 complete: Seller provided replies to solicitor — {address}" },
    ],
    heroLabel: [
      { text: "VM11 — Seller's replies provided" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed provision of replies to enquiries to vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
