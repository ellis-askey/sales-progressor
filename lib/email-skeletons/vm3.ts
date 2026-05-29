// VM3 — Seller has received the welcome pack from their solicitor.
//
// Non-bilateral, no route/direction conditioning. Vendor's "what next"
// branches on tenure (leasehold adds the management-pack-chase paragraph).
// Purchaser is universal — no shape conditioning in the FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const VM3_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Welcome pack received from your solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Welcome pack received" },
    ],
    opening: [
      { text: "Your solicitor's welcome pack has landed. That's their terms of business, the property questionnaire, and the ID requirements they need from you." },
    ],
    whatHappened: [
      {
        text: "Get this back as quickly as you can. Your solicitor can't do substantive work on your sale until your ID is cleared, the AML checks are done, and the forms are returned. A few days is the right benchmark. Longer than that and the sale starts losing pace.",
      },
    ],
    whatNext: [
      // Leasehold — adds the management-pack chase paragraph.
      {
        text: "If you haven't yet, this is also the moment to start chasing your freeholder for the management pack. It's the slowest piece on a leasehold sale, and starting that conversation now will save weeks later.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Seller is engaging with their solicitor, {address}" },
    ],
    heroLabel: [
      { text: "Seller received welcome pack" },
    ],
    opening: [
      { text: "The seller has their welcome pack from their solicitor. That's the kick-off paperwork for conveyancing on their side." },
    ],
    whatHappened: [
      {
        text: "Nothing for you to do right now. The seller will return the forms to their solicitor in the coming days.",
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
