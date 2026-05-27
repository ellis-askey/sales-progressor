// VM14 — Seller has provided additional replies to their solicitor.
//
// Non-bilateral connector between VM13 (additional enquiries received)
// and VM15 (additional replies issued). Mirror of VM11 for the follow-
// up round. Short bodies — by now the seller has been through this
// rhythm once already (VM11) so over-explaining the process would feel
// patronising.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM14_SKELETON: MilestoneSkeleton = {

  // Compressed vs VM11 deliberately. VM11 is the "you're new to this
  // rhythm" moment with a three-paragraph walk-through; VM14 fires
  // weeks later when the reader's been through this once already, so
  // a near-identical three-paragraph email would read as a stamped
  // template. Two paragraphs, varied construction, acknowledges the
  // round-1 rhythm rather than re-explaining it.
  vendor: {
    subject: [
      { text: "Follow-up replies — your part is done — {address}" },
    ],
    heroLabel: [
      { text: "Follow-up replies provided" },
    ],
    opening: [
      { text: "Round 2 of your input is in — your solicitor will now compile and issue the formal follow-up replies." },
    ],
    whatHappened: [
      // Trimmed: opening now carries "solicitor will compile and issue
      // the follow-up replies"; whatHappened restated the action.
      // Reduced to the round-1-rhythm framing + timing, the bits not in
      // the opening.
      {
        text: "Same rhythm as round 1 — typically a few days for the compilation.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // Same tightening on the buyer-side counterpart — single-paragraph
  // body. The reader's seen "Movement on the enquiries" before (VM11);
  // varying the opening keeps the two emails distinct.
  purchaser: {
    subject: [
      { text: "Seller has provided their follow-up input — {address}" },
    ],
    heroLabel: [
      { text: "Follow-up replies in progress" },
    ],
    opening: [
      { text: "Quick one on the follow-ups." },
    ],
    whatHappened: [
      {
        text: "The seller's input on the follow-up points is now with their solicitor. Expect the formal replies to land with your solicitor in the next few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM14 complete: Seller provided follow-up replies — {address}" },
    ],
    heroLabel: [
      { text: "VM14 — Seller's follow-up replies provided" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed provision of follow-up replies to vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
