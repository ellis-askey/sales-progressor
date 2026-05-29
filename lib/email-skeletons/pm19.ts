// PM19 — Buyer's solicitor has reviewed additional replies.
//
// Non-bilateral, buyer-only. Mirror of PM16 for the follow-up round.
// Shape-stable.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM19_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor has reviewed the follow-up replies, {address}" },
    ],
    heroLabel: [
      { text: "Follow-up replies reviewed" },
    ],
    opening: [
      { text: "Your solicitor has finished reviewing the follow-up replies." },
    ],
    whatHappened: [
      {
        text: "By this stage in the enquiry process, the most common landing is that the follow-up replies satisfy everything and the file moves on to the final report and contract sign-off. Occasionally one or two points remain open and a tight third round of enquiries is needed. That's unusual this late but not unheard of. Very occasionally something material surfaces that warrants a serious conversation about how to proceed.",
      },
    ],
    whatNext: [
      {
        text: "Whichever applies, your solicitor will come to you directly. If it's material concerns, expect a proper sit-down conversation rather than just an email update.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor block per FINAL — PM19 fires to purchaser only.

  progressor: {
    subject: [
      { text: "PM19 complete: Follow-up replies reviewed — {address}" },
    ],
    heroLabel: [
      { text: "PM19 — Follow-up replies reviewed" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed reviewing the follow-up replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
