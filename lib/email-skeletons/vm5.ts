// VM5 — Seller has received the property information forms.
//
// Seller-side moment where the leasehold add-on is substantive, not
// passing: leasehold sellers receive TA7 (leasehold information form)
// alongside TA6 (general property questionnaire) and TA10 (fittings &
// contents). The skeleton folds this into whatHappened so the leasehold
// reader sees the full form list inline, rather than as a follow-on
// paragraph that would feel detached from the "forms received" event.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM5_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Property information forms received — {address}" },
    ],
    heroLabel: [
      { text: "Property forms to complete" },
    ],
    opening: [
      { text: "Your solicitor needs information from you." },
    ],
    whatHappened: [
      // Universal — TA6 + TA10 are the standard forms every sale uses.
      {
        text: "Your solicitor has sent you the property information forms. These ask about the property's history, what's included in the sale, any disputes or planning permissions, and more — they're the foundation the buyer's solicitor will use to ask their questions, and your answers go into the contract pack.",
      },
      // Leasehold-only addendum to whatHappened. Lands as a separate
      // paragraph that names TA6/TA10/TA7 specifically — non-leasehold
      // readers get the unbranched description above without the form
      // codes, which keeps the universal paragraph plain-language.
      {
        text: "The forms in your pack are TA6 (the general property questionnaire), TA10 (fittings and contents) and TA7 (the leasehold information form — covering the lease itself, the freeholder relationship, service charges, and similar leasehold-specific details). The TA7 in particular needs care; the buyer's solicitor will scrutinise the leasehold answers closely.",
        when: { tenure: "leasehold" },
      },
    ],
    whatNext: [
      // Universal — fill in and return.
      {
        text: "Complete the forms as thoroughly and accurately as you can — these are legal documents and your answers are part of the contract. Return them to your solicitor promptly. If you're unsure about any question, call your solicitor before leaving it blank.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is gathering property information — {address}" },
    ],
    heroLabel: [
      { text: "Property forms in progress" },
    ],
    opening: [
      { text: "The seller is gathering property information." },
    ],
    whatHappened: [
      {
        text: "The seller has been sent their property information forms by their solicitor. These capture details about the property's history, what's included in the sale, and any planning or dispute history. Their answers will end up in the contract pack your solicitor reviews.",
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now. The seller will complete and return these to their solicitor in the coming days.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM5 complete: Seller received property forms — {address}" },
    ],
    heroLabel: [
      { text: "VM5 — Seller received property forms" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed receipt of property information forms (TA6/TA10, plus TA7 on leasehold)." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
