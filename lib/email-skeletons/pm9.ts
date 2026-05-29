// PM9 — Buyer has booked a Level 2 or Level 3 survey.
//
// Non-bilateral, buyer-side. Mortgage purchaser delta: adds a sentence
// distinguishing the buyer's own survey from the lender's valuation.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM9_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer has booked their survey, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's survey booked" },
    ],
    opening: [
      { text: "The buyer has booked their property survey. The surveyor will be in touch directly to arrange access. A typical visit is 1 to 3 hours depending on whether it's a Level 2 (homebuyer) or Level 3 (full structural) inspection." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Nothing for you to do beyond letting the surveyor in when they come. The report goes to the buyer directly, and any findings that affect the sale will come back to your solicitor as enquiries.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Your survey is booked, {address}" },
    ],
    heroLabel: [
      { text: "Survey booked" },
    ],
    opening: [
      // Cash / cash-from-proceeds — no separate-from-valuation framing.
      {
        text: "Your property survey is booked. The surveyor will go through the property in person and produce their report directly to you. A Level 2 (homebuyer) typically takes 1 to 2 hours on site; a Level 3 (full structural) can take 2 to 3.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage — adds "separate from the lender's valuation" sentence.
      {
        text: "Your property survey is booked. The surveyor will go through the property in person and produce their report directly to you. A Level 2 (homebuyer) typically takes 1 to 2 hours on site; a Level 3 (full structural) can take 2 to 3. This is your own survey, separate from the lender's valuation, and it's the one that gives you the real picture of the property's condition.",
        when: { purchaseType: "mortgage" },
      },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "The report usually lands within a week or two of the visit. Once you have it, read it carefully. If anything looks material, call your surveyor before deciding what to do. They've seen enough properties to give you a real sense of whether a finding is meaningful or routine.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM9 complete: Survey booked — {address}" },
    ],
    heroLabel: [
      { text: "PM9 — Survey booked" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer has confirmed booking of property survey." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
