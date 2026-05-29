// VM5 — Seller has received the property information forms.
//
// Non-bilateral, no route/direction conditioning. Vendor branches on
// tenure (leasehold adds TA7 to the form list and adds the buyer-side
// scrutiny note). Purchaser branches on tenure (leasehold adds lease,
// freeholder relationship, service charges to the form-contents list).
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM5_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Property information forms received, {address}" },
    ],
    heroLabel: [
      { text: "Property forms to complete" },
    ],
    opening: [
      // Freehold — TA6 + TA10 only.
      {
        text: "Your solicitor needs information from you. The property information forms have arrived: TA6 (the general property questionnaire) and TA10 (fittings and contents).",
        when: { tenure: "freehold" },
      },
      // Leasehold — adds TA7 and its leasehold scope.
      {
        text: "Your solicitor needs information from you. The property information forms have arrived: TA6 (general property questionnaire), TA10 (fittings and contents), and TA7 (the leasehold information form, covering the lease itself, your relationship with the freeholder, and service charge details).",
        when: { tenure: "leasehold" },
      },
    ],
    whatHappened: [
      // Freehold — generic accuracy + return-promptly framing.
      {
        text: "Complete these as thoroughly and accurately as you can. They're legal documents and your answers become part of the contract. Return them to your solicitor promptly. If you're unsure about any question, call your solicitor before leaving anything blank rather than guessing.",
        when: { tenure: "freehold" },
      },
      // Leasehold — same framing but flags TA7 specifically and the
      // buyer-side scrutiny note.
      {
        text: "Complete these as thoroughly and accurately as you can. They're legal documents and your answers become part of the contract. Return them to your solicitor promptly. If you're unsure about any question, especially on the TA7, call your solicitor before leaving anything blank. The buyer's solicitor will scrutinise the leasehold answers closely.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is gathering property information, {address}" },
    ],
    heroLabel: [
      { text: "Property forms in progress" },
    ],
    opening: [
      // Freehold — no leasehold-specific list items.
      {
        text: "The seller has their property information forms from their solicitor. Those capture details about the property's history, what's included in the sale, and its planning history. Their answers go into the contract pack your solicitor will review.",
        when: { tenure: "freehold" },
      },
      // Leasehold — adds the lease/freeholder/service-charge items.
      {
        text: "The seller has their property information forms from their solicitor. Those capture details about the property's history, what's included in the sale, planning history, and on a leasehold sale, the lease, freeholder relationship, and service charges. Their answers go into the contract pack your solicitor will review.",
        when: { tenure: "leasehold" },
      },
    ],
    whatHappened: [
      {
        text: "Nothing for you to do right now. The seller will complete and return the forms in the coming days.",
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
