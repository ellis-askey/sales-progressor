// VM3 — Seller has received the welcome pack from their solicitor.
//
// Mostly universal — the welcome pack itself is the same regardless of
// shape (terms of business + property questionnaire + ID list). Shape
// relevance is minor:
//   - Tenure: vendor whatNext adds a brief leasehold heads-up about the
//     management pack request that's running in parallel.
//   - Funding: none — buyer-side funding doesn't affect the seller's
//     welcome-pack experience.
//
// No bilateral pair. Single fan-out per side.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM3_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Welcome pack received from your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Welcome pack received" },
    ],
    opening: [
      { text: "Your solicitor has made contact." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has sent you their welcome pack. It contains their terms of business, a property questionnaire, and details of what ID they need from you. Returning this quickly is one of the best things you can do to keep the transaction moving.",
      },
    ],
    whatNext: [
      // Universal — return the pack.
      {
        text: "Complete the forms and return them as soon as you can — ideally within a few days. Your solicitor cannot begin substantive work on your sale until these are back with them.",
      },
      // Leasehold note — the parallel management-pack request.
      {
        text: "Get the welcome pack back quickly — your solicitor will also be requesting the management pack from your freeholder around now, and that piece typically takes several weeks to come back on its own clock. The sooner the welcome side is sorted, the better positioned you'll be when the management pack lands.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is engaging with their solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Seller received welcome pack" },
    ],
    opening: [
      { text: "The seller has their welcome pack." },
    ],
    whatHappened: [
      {
        text: "The seller has received their welcome pack from their solicitor — the kick-off paperwork for conveyancing on their side.",
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now. The seller will return the forms to their solicitor in due course.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "VM3 complete: Seller received welcome pack — {address}" },
    ],
    heroLabel: [
      { text: "VM3 — Seller received welcome pack" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Vendor has confirmed receipt of solicitor's welcome pack." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
