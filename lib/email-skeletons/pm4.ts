// PM4 — Buyer has paid money on account to their solicitor.
//
// Non-bilateral, no route/direction conditioning. Purchaser branches on
// purchaseType: mortgage adds the "keep your mortgage application
// progressing in parallel" line to the closing paragraph. Vendor
// universal across shapes.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM4_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Payment on account received by your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Payment on account received" },
    ],
    opening: [
      { text: "Your solicitor has your payment on account. That covers searches and disbursements they'll incur on your behalf during conveyancing. It's separate from your deposit." },
    ],
    whatHappened: [
      // Cash buyer + cash-from-proceeds — searches framing only.
      {
        text: "They can now order searches and proceed with the full conveyancing process. Searches take 2 to 4 weeks to come back depending on the local authority, so the sooner they're in, the sooner that piece is moving in the background.",
        when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } },
      },
      // Mortgage — adds the parallel mortgage-application line.
      {
        text: "They can now order searches and proceed with the full conveyancing process. Searches take 2 to 4 weeks to come back depending on the local authority. Keep your mortgage application progressing in parallel too, so the financing and the conveyancing move together rather than one waiting on the other.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer has put funds with their solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Buyer funds in place" },
    ],
    opening: [
      { text: "The buyer's funds are with their solicitor. That's the money on account that covers searches and disbursements during conveyancing. Buyers committing funds this early is one of the clearest signals they intend to proceed." },
    ],
    whatHappened: [
      {
        text: "Searches will be ordered shortly, and that's usually the next major step on the buyer's side.",
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
