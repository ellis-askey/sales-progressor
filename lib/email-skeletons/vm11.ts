// VM11 — Seller has provided initial replies to their solicitor.
//
// Non-bilateral, internal seller-side step between VM10 (enquiries
// received) and VM12 (replies issued to buyer's side). Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM11_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Your input on the enquiries is in, {address}" },
    ],
    heroLabel: [
      { text: "Replies drafted with you" },
    ],
    opening: [
      { text: "Your part of the enquiry response is done. The answers and information you sent to your solicitor cover the points the buyer's side raised in the first round." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Your solicitor will now compile your input into the formal written replies and send them across to the buyer's solicitor, typically within a few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller has provided their input on the enquiries, {address}" },
    ],
    heroLabel: [
      { text: "Replies being drafted" },
    ],
    opening: [
      { text: "Movement on the enquiries. The seller has given their solicitor the input needed to draft the formal replies, which will then come across to your solicitor." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Expect the replies to land in the next few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM11 complete: Seller input on enquiries provided — {address}" },
    ],
    heroLabel: [
      { text: "VM11 — Seller input provided" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed providing input to solicitor for initial enquiry replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
