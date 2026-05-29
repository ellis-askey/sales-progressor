// PM2 — Buyer has received the memorandum of sale.
//
// Purchaser only — PM2 has no vendor variant (VM2's purchaser variant
// covers the buyer-facing side of the MOS event, so we don't double-fire
// to the seller).
//
// Purchaser branches on purchaseType: cash-from-proceeds adds the
// related-sale reminder. No tenure conditioning in the FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM2_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Memorandum of sale issued, {address}" },
    ],
    heroLabel: [
      { text: "Legal process underway" },
    ],
    opening: [
      { text: "The memorandum of sale is with your solicitor, confirming the agreed purchase price and the names of both parties. That formally kicks off conveyancing." },
    ],
    whatHappened: [
      {
        text: "If you haven't already, return your solicitor's welcome pack and complete your ID checks. They can't get fully started until those are in.",
      },
    ],
    whatNext: [
      // Cash-from-proceeds — related-sale reminder.
      {
        text: "Your related sale matters here too: it has to exchange before this purchase can. Keep us posted, and your solicitor will coordinate the timing of both.",
        when: { purchaseType: "cash_from_proceeds" },
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
