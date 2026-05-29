// PM3 — Buyer has completed ID and AML checks with their solicitor.
//
// Non-bilateral, no route/direction conditioning. Purchaser branches on
// purchaseType: mortgage adds the "push on the mortgage application"
// sentence to the closing paragraph. Vendor universal across shapes.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM3_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "ID checks complete, {address}" },
    ],
    heroLabel: [
      { text: "ID & AML checks done" },
    ],
    opening: [
      { text: "ID and AML checks are done. That clears the way for your solicitor to begin substantive work on your purchase." },
    ],
    whatHappened: [
      // Cash buyer + cash-from-proceeds — money-on-account ask only.
      {
        text: "If you haven't yet paid money on account to your solicitor, do that as soon as you can. They'll need it before they can order searches on your behalf.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage — adds the "push on the mortgage application" line.
      {
        text: "If you haven't yet paid money on account to your solicitor, do that as soon as you can. They'll need it before they can order searches on your behalf. And if your mortgage application isn't in yet, push on it now. The sooner it's submitted, the sooner the valuation and offer follow.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's ID checks complete, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's ID & AML complete" },
    ],
    opening: [
      { text: "The buyer's ID and AML checks are done. Their solicitor can now begin substantive work on the purchase." },
    ],
    whatHappened: [
      {
        text: "Nothing for you to do right now. This is one of the early signals that things are moving properly on the buyer's side.",
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
