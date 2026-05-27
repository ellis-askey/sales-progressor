// PM16 — Buyer's solicitor has reviewed the initial replies.
//
// Non-bilateral closing event of Phase 10. PM15 was "replies are with
// your solicitor, review begins"; this is "review complete, here are
// the three possible outcomes." Distinct beat — the previous milestone's
// forward-look ("we'll let you know what your solicitor concludes")
// becomes the present moment here.
//
// Outcomes-driven framing: the review either lands clean (no follow-up),
// generates follow-up enquiries (Phase 11), or surfaces material concerns
// the buyer needs to think about. Reading this email, the buyer should
// know which one applies to them — the platform fills in the actual
// outcome from the solicitor's report. The skeleton frames the three
// possibilities without trying to pre-empt which one fired.
//
// No vendor email — this is a buyer-internal event. The seller already
// got VM12's "your part is done, buyer's side will review" ack and
// doesn't need a separate ping that the review happened.
//
// Funding conditioning: mortgage variant on whatNext flags the offer-
// window pressure that becomes real if Phase 11 (additional enquiries)
// is going to be invoked — protracted enquiries can put the mortgage
// offer's validity period under pressure. This is the natural place
// for that concern: the moment when the buyer learns whether there's
// more enquiry work to come.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM16_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor has reviewed the seller's replies — {address}" },
    ],
    heroLabel: [
      { text: "Reply review complete" },
    ],
    opening: [
      { text: "Your solicitor has finished reviewing the seller's replies." },
    ],
    whatHappened: [
      {
        text: "A review of this kind typically lands in one of three places: the replies satisfied everything and your solicitor's comfortable to move the file forward; some points need follow-up and additional enquiries will be raised; or something material has surfaced that warrants a conversation with you before deciding how to proceed.",
      },
    ],
    whatNext: [
      // Universal — talk to your solicitor.
      {
        text: "Your solicitor will be in touch (or already has been) about which of those applies to your file. If it's all clear, the file moves to the next stage. If it's follow-up enquiries, expect that to add a couple of weeks to the conveyancing timeline. If it's a material concern, your solicitor will walk you through what they've found and what your options are.",
      },
      // Mortgage variant — the genuine offer-window concern. Real causal
      // chain (enquiry delays → offer expiry risk) so this earns its
      // place, unlike the PM3 ID-checks bridge.
      {
        text: "If this round produced follow-up enquiries that extend the timeline, keep an eye on your mortgage offer's validity period — offers typically last 3–6 months from issue. Most files come in well within that, but if the conveyancing's already been running a while, your broker or solicitor will flag if an extension or re-offer becomes worth thinking about.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor email — see header comment.

  progressor: {
    subject: [
      { text: "PM16 complete: Replies reviewed by buyer's side — {address}" },
    ],
    heroLabel: [
      { text: "PM16 — Initial replies reviewed" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed review of initial replies." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
