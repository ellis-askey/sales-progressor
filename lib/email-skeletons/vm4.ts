// VM4 — Seller has completed ID and AML checks with their solicitor.
//
// Functionally universal across shapes — ID/AML is a legal requirement
// regardless of tenure or funding. Mild tenure variant on the vendor's
// "what next" to flag the property-information-form sequence that's
// about to begin (and on leasehold, the TA7 form alongside TA6/TA10).
//
// No bilateral pair.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM4_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "ID checks complete — {address}" },
    ],
    heroLabel: [
      { text: "ID & AML checks done" },
    ],
    opening: [
      { text: "You've cleared an important legal requirement." },
    ],
    whatHappened: [
      {
        text: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This clears the way for them to begin substantive work on your behalf.",
      },
    ],
    whatNext: [
      // Universal — property info forms are next.
      {
        text: "Your solicitor will now move on to preparing the contract pack. Within the next week or two you'll receive the property information forms (TA6 and TA10) — fill them in promptly when they arrive. Delays at that stage are one of the main things that slow transactions down.",
      },
      // Leasehold note — TA7 alongside the standard forms.
      {
        text: "Fill in the TA7 leasehold information form promptly when it lands too — that's the one covering the lease itself, your relationship with the freeholder, and service-charge details. It joins TA6 and TA10 in the property forms pack.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller's ID checks complete — {address}" },
    ],
    heroLabel: [
      { text: "Seller's ID & AML complete" },
    ],
    opening: [
      { text: "The seller has cleared their ID and AML checks." },
    ],
    whatHappened: [
      {
        text: "The seller has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the sale.",
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now — this is one of the early signals that things are moving properly on the seller's side. The next milestone you'll hear about on this trail is the contract pack going across to your solicitor.",
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
