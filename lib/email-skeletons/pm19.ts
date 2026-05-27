// PM19 — Buyer's solicitor has reviewed additional replies.
//
// Non-bilateral, buyer-only. Mirror of PM16 for the follow-up round —
// but with a distinct emphasis. PM16 framed three balanced outcomes
// (clean / further enquiries / material concern). At PM19 the
// probability distribution is different: the most common landing is
// "all clear, file moves on"; "further enquiries" is now unusual
// (would be a third round); "material concern surfacing this late"
// is more alarming and warrants a heavier conversation.
//
// No vendor email — same reasoning as PM16. Seller's already been
// told their part is done (VM15) and doesn't need a separate ping.
//
// No mortgage variant. PM16 already flagged the offer-window concern
// when follow-up enquiries became likely; restating it here would be
// a repeat of an already-said worry without adding new information.
// If the offer window is genuinely under pressure at this stage,
// the buyer's broker and solicitor will be on it — not the milestone
// email.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM19_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor has reviewed the follow-up replies — {address}" },
    ],
    heroLabel: [
      { text: "Follow-up review complete" },
    ],
    opening: [
      { text: "Your solicitor has finished reviewing the follow-up replies." },
    ],
    whatHappened: [
      // Outcome-distribution framing — by PM19 the most likely landing
      // is "all clear", with the other two paths flagged honestly as
      // less common at this stage.
      {
        text: "By this stage in the enquiry process, the most common landing is that the follow-up replies satisfy everything and the file moves on to the final report and contract sign-off. Occasionally one or two points remain open and a tight third round of enquiries is needed — that's unusual this late but not unheard-of. Very occasionally something material surfaces that warrants a serious conversation about how to proceed.",
      },
    ],
    whatNext: [
      // Varied construction vs PM16's closing paragraph: PM16 opens
      // "Your solicitor will be in touch (or already has been) about
      // which of those applies to your file..." and we don't want PM19
      // to fire the identical phrase a few weeks later. Same factual
      // content, different shape.
      {
        text: "Whichever applies, expect your solicitor to come to you directly — and if it's material concerns, expect a proper sit-down conversation rather than just an email update.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor email — see header.

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
      { text: "Purchaser solicitor has confirmed review of follow-up replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
