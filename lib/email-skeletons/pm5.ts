// PM5 — Buyer has submitted their mortgage application.
//
// Mortgage-only milestone (auto-NR'd on cash_buyer and cash_from_proceeds
// in lib/milestone-auto-nr.ts), so the skeleton doesn't need to branch on
// purchaseType — by the time PM5 fires at all, we already know the file
// is a mortgage file. Tenure has no bearing here either; the lender's
// process is the same regardless of freehold vs leasehold from the
// applicant's perspective at submission time. Shape-stable skeleton.
//
// Source: FINAL email matrix (journey-freehold-mortgage-FINAL.md).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM5_SKELETON: MilestoneSkeleton = {

  // ── Vendor: seller hearing the buyer's mortgage application is in ─────
  vendor: {
    subject: [
      { text: "Buyer has submitted their mortgage application, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's mortgage application in" },
    ],
    opening: [
      { text: "The buyer's mortgage application has gone in." },
    ],
    whatHappened: [
      {
        text: "The buyer has submitted their application to their lender. The lender will now begin underwriting and instruct a valuation on the property. The valuation visit is usually the next step on their side, and the formal mortgage offer follows within a few weeks once underwriting is complete.",
      },
    ],
    whatNext: [
      {
        text: "The surveyor doing the valuation may be in touch to arrange access. It's a brief visit, typically 30 to 60 minutes.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: buyer's own acknowledgement that the app is in ─────────
  purchaser: {
    subject: [
      { text: "Mortgage application submitted, {address}" },
    ],
    heroLabel: [
      { text: "Mortgage application in" },
    ],
    opening: [
      { text: "Your mortgage application is with the lender." },
    ],
    whatHappened: [
      {
        text: "They'll now begin underwriting, checking your finances, employment, and the property itself against their lending criteria. The lender will instruct a valuation on the property, which is usually the first thing they do after submission, often within a week or two. Once the valuation is back, the underwriter reviews everything together, and the formal mortgage offer normally follows within 1 to 3 weeks of that.",
      },
    ],
    whatNext: [
      {
        text: "Respond quickly to any document requests from the lender or your broker. Chasing missing payslips or bank statements is the most common cause of delay at this stage.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log, shape-stable (preserved unchanged) ──────
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
