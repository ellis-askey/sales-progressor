// PM27 — Buyer has received confirmation that the sale has completed.
//
// Agent-only confirm. Purchaser-only — no vendor body (VM20 handles
// the seller's completion notification). The final milestone of the
// whole 47-milestone journey, and the biggest moment of all: the buyer
// now owns the property. Earn the moment; don't go saccharine but
// don't undersell it either.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM27_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Completion — the property is yours — {address}" },
    ],
    heroLabel: [
      { text: "Completed" },
    ],
    opening: [
      { text: "Completion has happened. The property is yours." },
    ],
    whatHappened: [
      {
        text: "The balance funds have transferred to the seller's side, ownership has formally moved across to you, and the keys are now yours. Everything from the offer-accepted moment to this one — the conveyancing, the enquiries, the searches, the survey, the contracts — all of it was the work that gets you to here.",
      },
    ],
    whatNext: [
      {
        text: "Your solicitor will register the transfer with the Land Registry over the coming weeks — that's the formal legal record-keeping step, behind the scenes, no action from you. Practically: pick up the keys, switch the utilities into your name (your solicitor's completion statement will have the meter readings taken on the day), update your address with the bank, employer, DVLA, and the rest. Get the locks changed if you're inclined.",
      },
      {
        text: "From our side, this is where we step back. Thank you for letting us help you through it — it's a real moment, and we hope the place becomes everything you wanted it to be.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor body — VM20 handles the seller's completion notification.

  progressor: {
    subject: [
      { text: "PM27 complete: Completion confirmed on buyer's side — {address}" },
    ],
    heroLabel: [
      { text: "PM27 — Completion (buyer's side)" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has received confirmation of completion. Sale finalised; ownership transferred. File complete." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
