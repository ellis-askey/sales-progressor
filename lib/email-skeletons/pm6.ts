// PM6 — Lender valuation has been booked.
//
// Mortgage-only milestone (auto-NR'd on cash files). The physical-vs-
// desktop sub-state is intentionally NOT modelled as a condition key —
// that would be a fifth dimension and break the four-key rule. Instead
// the runtime fills `{vendorVisitNote}` / `{purchaserPhysicalNote}` and
// `{eventDateClause}` as inline interpolation, so the skeleton stays
// shape-stable and the physical/desktop distinction remains a render-
// time variable rather than a composition branch.
//
// Tenure is irrelevant at this stage — the lender's valuation process
// doesn't differ by freehold vs leasehold from the booking moment.
//
// Source: FINAL email matrix (journey-freehold-mortgage-FINAL.md).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM6_SKELETON: MilestoneSkeleton = {

  // ── Vendor: seller hearing the buyer's lender valuation is booked ─────
  vendor: {
    subject: [
      { text: "Buyer's lender valuation booked, {address}" },
    ],
    heroLabel: [
      { text: "Lender valuation booked" },
    ],
    opening: [
      { text: "The buyer's lender has booked the valuation{eventDateClause}." },
    ],
    whatHappened: [
      {
        // Runtime placeholder. The send path fills this with the visit-
        // specific copy ("the surveyor will visit the property...") on
        // physical valuations, or the desktop variant when there's no
        // physical visit. Preserves the four-condition-key discipline.
        text: "{vendorVisitNote}",
      },
    ],
    whatNext: [
      {
        text: "Once the valuation report is back with the lender, underwriting can finish, and the formal mortgage offer follows within a few weeks.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Purchaser: buyer's own acknowledgement that the valuation is set ──
  purchaser: {
    subject: [
      { text: "Lender valuation booked, {address}" },
    ],
    heroLabel: [
      { text: "Valuation booked" },
    ],
    opening: [
      { text: "Your lender's valuation is scheduled{eventDateClause}." },
    ],
    whatHappened: [
      {
        // Runtime placeholder fills the physical-vs-desktop opening
        // sentences. The "worth knowing" tail below is shape-stable.
        text: "{purchaserPhysicalNote} Worth knowing: this is the lender's valuation, carried out for their risk assessment, not the same as your own survey. If you want a fuller picture of the property's condition for your own peace of mind, that's a separate survey you book yourself.",
      },
    ],
    whatNext: [
      {
        text: "Once the valuation is done, the report goes back to your lender's underwriter and feeds into the final decision. The formal mortgage offer follows within 1 to 3 weeks of the valuation, depending on the lender.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log (preserved unchanged) ────────────────────
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
