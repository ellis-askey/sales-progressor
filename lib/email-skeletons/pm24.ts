// PM24 — Buyer has transferred the deposit.
//
// Auto-NR'd on cash_from_proceeds (deposit comes from the concurrent
// sale's equity at completion, not a pre-exchange transfer). Fires on
// mortgage and cash_buyer files only — but the deposit transfer itself
// works the same way on both shapes (it's the buyer's own funds going
// into their solicitor's client account before exchange, separate from
// any lender advance, which lands at completion). So no funding
// conditioning needed inside the skeleton; the milestone is suppressed
// for the shape where it doesn't apply.
//
// Substantive moment for both readers: the deposit is the last buyer-
// side input before exchange becomes a procedural decision between the
// two solicitors. From the seller's side, this is one of the clearest
// commitment signals on the whole file.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM24_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Deposit transferred — {address}" },
    ],
    heroLabel: [
      { text: "Deposit transferred" },
    ],
    opening: [
      { text: "Your deposit is with your solicitor." },
    ],
    whatHappened: [
      {
        text: "You've transferred the deposit funds to your solicitor's client account. They'll hold them in escrow alongside your signed contracts until the exchange moment, when the deposit transfers across to the seller's solicitor as the binding part of the agreement.",
      },
    ],
    whatNext: [
      {
        text: "With the deposit in place and contracts signed, exchange becomes a procedural decision between the two solicitors on timing. Exchange typically follows within a few days from here.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has transferred the deposit — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's deposit in" },
    ],
    opening: [
      { text: "The deposit is with the buyer's solicitor." },
    ],
    whatHappened: [
      {
        text: "The buyer has transferred the deposit funds to their solicitor's client account. With contracts signed on both sides and the deposit now in place, the last meaningful buyer-side input is done.",
      },
    ],
    whatNext: [
      {
        text: "Exchange now sits with the two solicitors to agree timing — usually within a few days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM24 complete: Buyer deposit transferred — {address}" },
    ],
    heroLabel: [
      { text: "PM24 — Deposit transferred" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed transfer of deposit to purchaser solicitor's client account." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
