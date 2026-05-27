// PM6 — Lender valuation has been booked.
//
// Mortgage-only milestone (auto-NR'd on cash files). The physical-vs-
// desktop sub-state is intentionally NOT modelled as a condition key —
// that would be a fifth dimension and break the four-key rule. Instead
// the runtime fills `{vendorVisitNote}` / `{purchaserPhysicalNote}` and
// `{eventDate}` / `{eventDateClause}` as inline interpolation, so the
// skeleton stays shape-stable and the physical/desktop distinction
// remains a render-time variable rather than a composition branch.
//
// Tenure is irrelevant at this stage — the lender's valuation process
// doesn't differ by freehold vs leasehold from the booking moment.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM6_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Lender valuation booked — {address}" },
    ],
    heroLabel: [
      { text: "Valuation booked" },
    ],
    opening: [
      { text: "Your lender's valuation is scheduled." },
    ],
    whatHappened: [
      {
        text: "Your lender has booked the valuation{eventDateClause}. {purchaserPhysicalNote}",
      },
    ],
    whatNext: [
      {
        text: "Once the valuation is done, the report goes back to your lender's underwriter and feeds into the final decision. The formal mortgage offer typically follows within 1–3 weeks of the valuation, depending on the lender.",
      },
      {
        text: "Keep your survey and conveyancing progressing in parallel — those run on their own clocks and shouldn't wait for the mortgage offer to land.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's lender valuation booked — {address}" },
    ],
    heroLabel: [
      { text: "Lender valuation booked" },
    ],
    opening: [
      { text: "The buyer's lender has booked the valuation." },
    ],
    whatHappened: [
      {
        text: "The buyer's lender has booked the valuation{eventDateClause}. {vendorVisitNote}",
      },
    ],
    whatNext: [
      {
        text: "Once the valuation report is back with the lender, underwriting can finish and the formal mortgage offer typically follows within a few weeks.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM6 complete: Lender valuation booked — {address}" },
    ],
    heroLabel: [
      { text: "PM6 — Lender valuation booked" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Lender valuation booked{eventDateClause}." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
