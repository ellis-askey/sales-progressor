// VM17 — Seller's solicitor has received signed contract documents back
// from the seller.
//
// Universal across shape. Seller-side: closure on their active part of
// contract sign-off. Buyer-side: meaningful commitment signal. The
// buyer-side mirror PM23 carries the bigger weight (both-sides-now-
// committed moment), so VM17 purchaser body keeps it focused on what
// the seller's signature uniquely signifies — they've committed; only
// the buyer's side remains.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM17_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Signed contracts received by your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Contracts signed" },
    ],
    opening: [
      { text: "Your signed contracts are back with your solicitor." },
    ],
    whatHappened: [
      // Order-agnostic — VM17 and PM23 can fire in either order. Earlier
      // draft said "once the buyer's side has reached the same point",
      // which presupposes PM23 hasn't fired.
      {
        text: "Your active part of the contract sign-off is complete. Your solicitor will hold the signed documents in escrow; once both sides are signed, the two solicitors can begin coordinating the actual exchange moment.",
      },
    ],
    whatNext: [
      // Order-agnostic — earlier draft said "We'll keep you posted on
      // the buyer's side's signing progress", which is wrong if PM23
      // fired before VM17.
      {
        text: "Exchange happens when both solicitors confirm they're ready — both sides signed, deposit funds in place, completion date agreed. Exchange is the next moment on the file's timeline.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller has signed the contracts — {address}" },
    ],
    heroLabel: [
      { text: "Seller signed" },
    ],
    opening: [
      { text: "The seller has signed and returned their contracts." },
    ],
    whatHappened: [
      // Order-agnostic — VM17 and PM23 can fire in either order. Earlier
      // draft said "only your side's signing remains before exchange can
      // happen", which is wrong if PM23 has already fired.
      {
        text: "The seller has signed and returned their contract documents. Their solicitor is now holding the signed contracts in escrow. The seller's side is committed; exchange follows once both sides are signed.",
      },
    ],
    // No whatNext — PM22 (your contracts to sign) and PM23 (you've
    // signed) will follow shortly and carry the buyer-side forward-
    // look. This body is the "seller is locked in" moment.
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM17 complete: Seller signed contracts returned — {address}" },
    ],
    heroLabel: [
      { text: "VM17 — Seller signed contracts received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor solicitor has confirmed receipt of signed contract documents from vendor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
