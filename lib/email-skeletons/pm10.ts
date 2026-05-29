// PM10 — Buyer has received the survey report.
//
// Unilateral buyer-side. Purchaser only (no vendor email per FINAL).
// Shape-stable across all six shapes.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM10_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your survey report is in, {address}" },
    ],
    heroLabel: [
      { text: "Survey report received" },
    ],
    opening: [
      { text: "Your survey report has landed." },
    ],
    whatHappened: [
      {
        text: "Read it carefully. The surveyor's findings are organised by traffic-light condition ratings: green is fine, amber is something to be aware of, red is something to act on. Focus on the reds and the ambers. Call your surveyor on anything you don't understand or aren't sure how to weigh. They'll usually explain over the phone, and they can tell you whether a specific finding is genuinely material or whether it's a standard observation for a property of this type.",
      },
    ],
    whatNext: [
      {
        text: "If anything from the report needs to be raised with the seller's side (a defect that affects price or completion, evidence of something the property forms didn't mention), your solicitor is the right route. Decide first what you actually want to ask for, then talk to your solicitor about how to put it across.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // No vendor block per FINAL — PM10 fires to purchaser only.

  progressor: {
    subject: [
      { text: "PM10 complete: Survey report received — {address}" },
    ],
    heroLabel: [
      { text: "PM10 — Survey report received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer has confirmed receipt of survey report." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
