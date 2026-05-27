// PM4 — Buyer has paid money on account to their solicitor.
//
// Foundational early step on the buyer side — unlocks searches. Funding
// relevance: mortgage variant prompts the parallel lender check; cash
// buyers and CFP buyers don't have that prompt (their cash flow doesn't
// gate on a lender). Tenure relevance is minimal at this stage.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM4_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Payment on account received by your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Payment on account received" },
    ],
    opening: [
      { text: "Thank you — your solicitor has received your payment on account." },
    ],
    whatHappened: [
      {
        text: "Your initial payment to your solicitor has been received. This covers the cost of searches and other disbursements they'll incur on your behalf during the conveyancing process. This is separate from your deposit.",
      },
    ],
    whatNext: [
      // Universal — searches can now be ordered.
      {
        text: "Your solicitor can now order searches and proceed with the full conveyancing process. Searches typically take 2–4 weeks to come back depending on the local authority, so the sooner they're in, the sooner that piece is moving in the background.",
      },
      // Mortgage variant — parallel lender check.
      {
        text: "Your lender's clock matters too — keep your mortgage application progressing in parallel. The valuation tends to be the lender's first move after submission, and the formal offer typically follows within 1–3 weeks of that.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has put funds with their solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Buyer funds in place" },
    ],
    opening: [
      { text: "The buyer's funds are with their solicitor." },
    ],
    whatHappened: [
      {
        text: "The buyer has transferred money on account to their solicitor — funds that cover the cost of searches and disbursements during conveyancing. Buyers committing money this early is one of the clearest signals they intend to proceed.",
      },
    ],
    whatNext: [
      {
        text: "Searches will typically be ordered shortly — that's usually the next major step on the buyer's side.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM4 complete: Buyer paid money on account — {address}" },
    ],
    heroLabel: [
      { text: "PM4 — Buyer paid money on account" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed payment on account to solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
