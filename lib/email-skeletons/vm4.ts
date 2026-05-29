// VM4 — Seller has completed ID and AML checks with their solicitor.
//
// Non-bilateral, no route/direction conditioning. Vendor branches on
// tenure (leasehold lists TA7 alongside TA6/TA10 and frames the delay
// risk as leasehold-specific). Purchaser branches on tenure (leasehold
// extends the wait to "a few weeks" and mentions the management pack).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM4_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "ID checks complete, {address}" },
    ],
    heroLabel: [
      { text: "ID & AML checks done" },
    ],
    opening: [
      { text: "ID and AML checks are done. That clears the way for your solicitor to begin substantive work." },
    ],
    whatHappened: [
      // Freehold — TA6 + TA10 only.
      {
        text: "They'll now move on to preparing the contract pack. Within the next week or two you'll receive the property information forms (TA6 and TA10). Fill them in promptly when they arrive. Delays at that stage are one of the main things that slow a sale down.",
        when: { tenure: "freehold" },
      },
      // Leasehold — adds TA7 and frames delays as a leasehold concern.
      {
        text: "They'll now move on to preparing the contract pack. Within the next week or two you'll receive the property information forms (TA6, TA7 for the leasehold side, and TA10). Fill them in promptly when they arrive. Delays at that stage are one of the main things that slow leasehold sales down.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's ID checks complete, {address}" },
    ],
    heroLabel: [
      { text: "Seller's ID & AML complete" },
    ],
    opening: [
      { text: "The seller's ID and AML checks are done. Their solicitor can now begin substantive work on the sale." },
    ],
    whatHappened: [
      // Freehold — "a week or two" wait.
      {
        text: "Nothing for you to do right now. The next thing you'll see on this trail is the contract pack arriving with your solicitor, likely a week or two away while the seller completes their property information forms.",
        when: { tenure: "freehold" },
      },
      // Leasehold — "a few weeks" wait, mentions the management pack.
      {
        text: "Nothing for you to do right now. The next thing you'll see on this trail is the contract pack arriving with your solicitor, likely a few weeks away while the seller completes their property information forms and waits on the management pack from the freeholder.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM4 complete: Seller ID checks done — {address}" },
    ],
    heroLabel: [
      { text: "VM4 — Seller ID & AML complete" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed completion of ID and AML verification." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
