// PM10 — Buyer has received the survey report.
//
// Second of two survey milestones. PM9 owns the survey-types explainer;
// this body refers to "the survey" and "the report" without re-listing
// Level 2 vs Level 3. The substantive beat here is different: this is
// the decision moment for the buyer — what to do with the findings.
//
// No funding conditioning. The buyer's options after a survey (accept,
// request remedy, renegotiate, walk) are materially the same regardless
// of how the purchase is being funded. A mortgage-only add-on along the
// lines of "your lender may want to see significant findings" would be
// a second ripple-effect-of-findings paragraph on top of PM13's, which
// is exactly the kind of forced mortgage bridge the PM3 note flagged.
// The universal "this is your moment to decide" framing carries weight
// for every shape on its own.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM10_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your survey report is in — {address}" },
    ],
    heroLabel: [
      { text: "Survey report received" },
    ],
    opening: [
      { text: "Your survey report has landed." },
    ],
    whatHappened: [
      {
        text: "The surveyor has issued the report. Most reports group findings by priority — items that need urgent attention, items that are significant but not urgent, and items the surveyor flags for awareness only. Read all three sections, not just the urgent one.",
      },
    ],
    whatNext: [
      // Universal — the decision moment. The substantive beat the whole
      // milestone exists for. Agent voice: direct, advisory, doesn't
      // hedge.
      {
        text: "This is your decision point. With the findings in front of you, there are four reasonable paths — accept and proceed as-is, ask the seller to put specific things right before exchange, negotiate the price down to reflect the work needed, or walk away if it's revealed something you didn't sign up for. Most surveys land somewhere in the middle, and most sales continue after a conversation. But the report is the moment to actually think it through, not later.",
      },
      {
        text: "If you're not sure how to read something or what's worth pushing back on, call your surveyor and ask — they'll usually explain over the phone, and they've seen enough properties to give you a sense of whether a finding is meaningful or routine. Your solicitor will route any conversation with the seller's side once you've decided what (if anything) you want to ask for.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's survey is back — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's survey received" },
    ],
    opening: [
      { text: "The buyer's survey report has come back." },
    ],
    whatHappened: [
      {
        text: "The buyer now has their survey report. They'll be reading through it over the next few days and deciding what (if anything) to take up with your side.",
      },
    ],
    whatNext: [
      // PM9 vendor whatNext already framed "if something material comes
      // up that affects the sale, it'll come through to your side as
      // questions or a renegotiation conversation". Restating that here
      // would be a paired-read seam: same forward-look fired twice 1–2
      // weeks apart. This body focuses on the present moment — the
      // buyer is reading the report now, the next few days are when
      // their response (if any) will surface — and gives the agent's
      // honest perspective on what kinds of asks tend to be reasonable
      // versus opportunistic.
      {
        text: "Most surveys lead to a conversation rather than a problem — buyers often ask for clarification on specific findings or, occasionally, a modest price adjustment. If something does come through, we'll talk it through with you honestly — what's worth giving on, what isn't, what's reasonable for a buyer to ask given the property's age and price.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM10 complete: Survey report received — {address}" },
    ],
    heroLabel: [
      { text: "PM10 — Survey report received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed receipt of survey report." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
