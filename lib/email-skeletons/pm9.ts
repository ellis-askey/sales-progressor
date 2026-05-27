// PM9 — Buyer has booked a Level 2 or Level 3 survey.
//
// First of two survey milestones (PM9 → PM10). Buyer-side, non-bilateral,
// applies to every shape. PM9 owns the "what a survey is and the
// Level 2 / Level 3 distinction" explainer; PM10 refers to "the survey"
// and "the report" without re-explaining the survey types.
//
// No tenure or funding conditioning. Tenure doesn't change the survey
// experience meaningfully at this stage (the buyer has already chosen
// Level 2 or Level 3 based on the property and that decision is now
// locked). Funding doesn't change PM9 either — the survey runs the
// same regardless of how it's being paid for, and the funding
// implication of survey findings is a PM10-shaped conversation, not
// a PM9 one.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM9_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Survey booked — {address}" },
    ],
    heroLabel: [
      { text: "Survey booked" },
    ],
    opening: [
      { text: "Your survey is in the diary." },
    ],
    whatHappened: [
      {
        text: "Your surveyor has been booked. A Level 2 (HomeBuyer Report) gives a clear visual assessment with a defect summary; a Level 3 (Building Survey) is the more thorough option, more typical on older or unusual properties. This is separate from the lender's valuation — it's for your peace of mind, not the lender's risk assessment.",
      },
    ],
    whatNext: [
      {
        text: "The surveyor will visit the property and produce the report within about a week of the visit. If you have specific concerns — damp you noticed on viewings, a roof you weren't sure about, an extension you want checked — write them down and email them to the surveyor before the visit. A surveyor told what to look at tends to find more than one left to a generic sweep.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has booked their survey — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's survey booked" },
    ],
    opening: [
      { text: "The buyer has booked their survey." },
    ],
    whatHappened: [
      {
        text: "The buyer has booked their property survey. The surveyor will be in touch directly to arrange access — typically a 1–3 hour visit depending on whether it's a Level 2 or Level 3 inspection.",
      },
    ],
    whatNext: [
      {
        text: "Give the surveyor reasonable access on the agreed date. The report goes to the buyer about a week after the visit; if anything material comes up that affects the sale, it'll come through to your side as questions or a renegotiation conversation.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM9 complete: Buyer's survey booked — {address}" },
    ],
    heroLabel: [
      { text: "PM9 — Buyer's survey booked" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed survey booking." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
