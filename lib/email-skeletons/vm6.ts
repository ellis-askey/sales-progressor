// VM6 — Seller has returned completed property information forms.
//
// Positive milestone — the forms are back with the solicitor and the
// contract pack is next. Mostly universal; leasehold note flags the
// pending management pack as the remaining piece before the full
// contract pack can go out.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM6_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Property forms returned to your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Property forms returned" },
    ],
    opening: [
      { text: "Your forms are back with your solicitor." },
    ],
    whatHappened: [
      {
        text: "Your completed property information forms have been received by your solicitor. They'll now incorporate these into the contract pack and send everything to the buyer's solicitor.",
      },
    ],
    whatNext: [
      // Universal — contract pack next.
      {
        text: "Your solicitor will issue the draft contract pack to the buyer's solicitor over the coming days; the next email on this trail will be the issuance confirmation.",
      },
      // Leasehold note — the management pack is the remaining piece.
      {
        text: "Chase the freeholder yourself if the management pack's still outstanding — that's the piece the contract pack needs before it can go out in full. If it's already back, your solicitor will fold it in and issue the contract pack imminently. If not, it's the remaining piece holding things up.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "The seller has returned their property information forms — {address}" },
    ],
    heroLabel: [
      { text: "Property forms returned" },
    ],
    opening: [
      { text: "Property forms returned on the seller's side." },
    ],
    whatHappened: [
      {
        text: "The seller has returned their completed property information forms to their solicitor. These will be included in the contract pack that comes to your solicitor.",
      },
    ],
    whatNext: [
      // Universal — wait for contract pack.
      {
        text: "Nothing to do from your side right now. The seller's solicitor will now finalise the contract pack and send it across to your solicitor.",
      },
      // Leasehold note — management pack is the remaining gating piece
      // on the seller's side, so the buyer knows why there might still
      // be a wait before the contract pack lands.
      {
        text: "One thing to be aware of on a leasehold purchase — the seller's solicitor also needs the management pack from the freeholder before the full contract pack can come across. If that hasn't landed on the seller's side yet, that's the remaining piece you're waiting on.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM6 complete: Seller returned property forms — {address}" },
    ],
    heroLabel: [
      { text: "VM6 — Seller returned property forms" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed return of completed property information forms to solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
