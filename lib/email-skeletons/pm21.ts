// PM21 — Buyer has received the final report from their solicitor.
//
// First milestone of Phase 12 (final report + contract sign-off).
// Universal across shape — final reports happen on every file. PM20
// already told the buyer "the file now moves to the final report stage,
// where your solicitor pulls together everything they've learned about
// the property and walks you through it before exchange" — so PM21
// doesn't re-explain what the final report IS. Its beat is the
// reading moment: this is the buyer's "do I want to do this?" pause
// before signing.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM21_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your final report is in — {address}" },
    ],
    heroLabel: [
      { text: "Final report received" },
    ],
    opening: [
      { text: "Your solicitor's final report has landed." },
    ],
    whatHappened: [
      {
        text: "The report is your solicitor's structured summary of everything they've found out about the property through searches, enquiries, and the contract pack — title, planning, lease (if applicable), service charges, anything material that surfaced along the way. It's not new investigation; it's the digest.",
      },
    ],
    whatNext: [
      {
        text: "Read it carefully — this is your considered moment before signing the contracts. Write down anything that's unclear or that you want to talk through, and call your solicitor before you sign rather than after. Once you're comfortable, your solicitor will issue the contracts for you to sign; the final report is the last substantial reading moment before the file enters execution mode.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has the final report — {address}" },
    ],
    heroLabel: [
      { text: "Buyer reading final report" },
    ],
    opening: [
      // Event-named opening rather than "X signal on your sale" — the
      // seller reads PM21 → PM23 vendor bodies a few weeks apart and
      // both as "signal" openings would feel templated. PM23 keeps
      // "Real signal..." as the heavier moment; PM21 leads with the
      // event itself.
      { text: "The buyer has the final report now." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has sent them the final report — the structured summary of everything that's come out of the conveyancing process. The buyer is now in the reading-and-deciding window before contracts go out for signing.",
      },
    ],
    whatNext: [
      {
        text: "Contract documents typically follow within a few days of the buyer being comfortable with the report. Your side's contract documents will be issued by your solicitor in parallel.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM21 complete: Buyer received final report — {address}" },
    ],
    heroLabel: [
      { text: "PM21 — Final report received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed receipt of final report from purchaser solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
