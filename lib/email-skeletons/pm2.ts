// PM2 — Buyer has received the memorandum of sale.
//
// Carries one structural decision from the inventory voice flag: PM2 has
// no vendor variant in the existing portal-copy.ts (asymmetric vs VM2,
// which has both). The decision recorded in the inventory is to keep
// asymmetric — VM2's purchaser variant already covers the buyer-facing
// side of the MOS event, so PM2's seller-side notification would be
// redundant. Skeleton mirrors that: no vendor variant defined here.
//
// Shape relevance:
//   - Funding: replaces the existing "If you're buying with a mortgage..."
//     inline qualifier with proper purchaseType branching.
//   - Tenure: leasehold heads-up so the wait for the management pack
//     isn't a surprise.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM2_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Memorandum of sale issued — {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      // Varied vs VM2 vendor / VM2 purchaser, which previously all
      // opened identically with "The legal process has officially
      // started." The buyer reads PM2 purchaser and VM2 purchaser
      // close together — identical openings cluster as templates.
      { text: "The memorandum of sale is with your solicitor." },
    ],
    whatHappened: [
      {
        text: "The MoS has been sent to all solicitors, confirming the agreed purchase price and the details of both parties — it's the document that formally kicks off conveyancing. Your solicitor now has formal confirmation to begin.",
      },
    ],
    whatNext: [
      // Universal — welcome pack + ID is foundational.
      {
        text: "If you haven't already, return your solicitor's welcome pack and complete your ID checks — your solicitor can't get fully started on your purchase until these are done.",
      },
      // Mortgage variant — replaces the existing inline "if you're
      // buying with a mortgage" hedge. Fires only on mortgage files.
      {
        text: "Keep your mortgage application progressing in parallel — the sooner it's in, the sooner the valuation and offer follow.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds variant — opens "Your concurrent sale…"
      // (not "Because…") so it pairs cleanly with the leasehold
      // paragraph below on Leasehold × CFP.
      {
        text: "Your concurrent sale matters here too — the timing of that sale's exchange is the gating step for your purchase. Keep us posted on its progress; your solicitor will want to coordinate the two.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Tenure addendum — leasehold heads-up.
      {
        text: "The seller's solicitor will be requesting a management pack from the freeholder around now — those packs often take several weeks to come back on their own clock, so the wait isn't a surprise.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor variant — see file header. PM2 deliberately doesn't email
  // the seller; VM2's purchaser variant already covers that direction.

  progressor: {
    subject: [
      { text: "PM2 complete: MoS received — {address}" },
    ],
    heroLabel: [
      { text: "PM2 — MoS received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Memorandum of sale confirmed received by buyer's solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
