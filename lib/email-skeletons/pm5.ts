// PM5 — Buyer has submitted their mortgage application.
//
// Mortgage-only milestone (auto-NR'd on cash_buyer and cash_from_proceeds
// in lib/milestone-auto-nr.ts), so the skeleton doesn't need to branch on
// purchaseType — by the time PM5 fires at all, we already know the file
// is a mortgage file. Tenure has no bearing here either; the lender's
// process is the same regardless of freehold vs leasehold from the
// applicant's perspective at submission time. Shape-stable skeleton.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM5_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Mortgage application submitted — {address}" },
    ],
    heroLabel: [
      { text: "Mortgage application in" },
    ],
    opening: [
      { text: "Your mortgage application is with the lender." },
    ],
    whatHappened: [
      {
        text: "Your mortgage application has been submitted to the lender. They'll now begin underwriting — checking your finances, employment, and the property itself against their lending criteria.",
      },
    ],
    whatNext: [
      {
        text: "The lender will instruct a valuation on the property — that's typically the first thing they do after submission, often within a week or two. Once the valuation comes back, the underwriter reviews everything together; the formal mortgage offer normally follows within 1–3 weeks of that, though it varies by lender.",
      },
      {
        text: "Respond quickly to any document requests from the lender or your broker — chasing missing payslips or bank statements is the most common cause of delay at this stage.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has submitted their mortgage application — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's mortgage application in" },
    ],
    opening: [
      { text: "The buyer's mortgage application has gone in." },
    ],
    whatHappened: [
      {
        text: "The buyer has submitted their mortgage application to their lender. The lender will now begin underwriting and instruct a valuation on the property.",
      },
    ],
    whatNext: [
      {
        text: "The valuation visit (or desktop check) is usually the next step on the lender's side. The formal mortgage offer typically follows within a few weeks once underwriting is complete.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM5 complete: Mortgage application submitted — {address}" },
    ],
    heroLabel: [
      { text: "PM5 — Mortgage application submitted" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed submission of mortgage application to lender." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
