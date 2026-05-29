// VM14 — Seller has provided additional replies to their solicitor.
//
// Non-bilateral connector between VM13 (additional enquiries received)
// and VM15 (additional replies issued). Mirror of VM11 for the follow-up
// round. Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM14_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Your input on the follow-ups is in, {address}" },
    ],
    heroLabel: [
      { text: "Follow-up input drafted" },
    ],
    opening: [
      { text: "Your part on the follow-up enquiries is done. Your solicitor will now compile your input into the formal written replies and send them across." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Same rhythm as round one. A few days for the compilation, then the replies go to the buyer's side.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller has provided their input on the follow-ups, {address}" },
    ],
    heroLabel: [
      { text: "Follow-up replies being drafted" },
    ],
    opening: [
      { text: "The seller has given their solicitor the input for the follow-up replies, which will then come across to your solicitor." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Expect them to land in the next few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM14 complete: Seller input on follow-ups provided — {address}" },
    ],
    heroLabel: [
      { text: "VM14 — Follow-up input provided" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed providing input to solicitor for follow-up enquiry replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
