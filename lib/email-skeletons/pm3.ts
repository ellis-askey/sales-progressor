// PM3 — Buyer has completed ID and AML checks with their solicitor.
//
// Mirror of VM4 but for the buyer side. Shape relevance:
//   - Funding: mortgage-only paragraph about the parallel lender-side
//     work (the lender will reference ID/AML status when underwriting);
//     cash-from-proceeds paragraph about the concurrent-sale dependency
//     since both timelines need to align.
//   - Tenure: no purchaser-side tenure conditioning here — the leasehold
//     management-pack story is the seller's solicitor's job, not the
//     buyer's at this stage.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM3_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "ID checks complete — {address}" },
    ],
    heroLabel: [
      { text: "ID & AML checks done" },
    ],
    opening: [
      { text: "You've cleared an important legal requirement." },
    ],
    whatHappened: [
      {
        text: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This allows them to begin substantive work on your purchase.",
      },
    ],
    whatNext: [
      // Universal — payment on account is the foundational ask.
      {
        text: "Your solicitor is now able to work on your case fully. If you haven't yet paid money on account to your solicitor, do that as soon as you can — they'll need it before they can order searches on your behalf.",
      },
      // Mortgage variant — opens "Your lender…" not "Because…".
      {
        text: "Your lender will reference your completed ID and AML as part of their underwriting too, so keep your mortgage application progressing in parallel — the sooner that's in, the sooner the valuation and offer follow.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds variant — opens "Your concurrent sale…".
      {
        text: "Your concurrent sale is part of the picture too — that sale's exchange is what funds your deposit, so keep us posted on its progress. Your solicitor will want to coordinate the two timelines as exchange approaches.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's ID checks complete — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's ID & AML complete" },
    ],
    opening: [
      { text: "The buyer's ID and AML checks are done." },
    ],
    whatHappened: [
      {
        text: "The buyer has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the purchase.",
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now — this is one of the early signals that things are moving properly on the buyer's side.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM3 complete: Buyer ID checks done — {address}" },
    ],
    heroLabel: [
      { text: "PM3 — Buyer ID & AML complete" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed completion of ID and AML verification." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
