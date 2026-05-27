// PM8 — Buyer's solicitor has ordered searches.
//
// First of two searches milestones (PM8 → PM13). Non-bilateral, applies
// to every shape (freehold + leasehold, all funding types). PM8 owns
// the "what are searches" explainer; PM13 refers to "the searches"
// without re-listing the bundle, to keep the paired sequence reading
// as two distinct events (ordering → results back) rather than two
// takes on the same bundle.
//
// No tenure or funding conditioning at this stage — searches are
// ordered the same way on every shape. Funding only becomes relevant
// at PM13 (results back), where a mortgage variant flags lender
// implications of any findings.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM8_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Searches ordered — {address}" },
    ],
    heroLabel: [
      { text: "Searches ordered" },
    ],
    opening: [
      { text: "Your solicitor has ordered the property searches." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has placed the property searches — usually a Local Authority search (covering planning, road adoption, restrictions, building control), a Drainage & Water search, and an Environmental search. Depending on the area, they may also order Chancel Repair, Coal Mining, or other location-specific searches.",
      },
    ],
    whatNext: [
      {
        text: "Results typically take 2–4 weeks to come back, though the Local Authority search is often the slowest piece and can stretch longer in some areas. Your solicitor will review everything once it's all in and flag anything material. This one runs in the background while the enquiries side progresses.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's solicitor has ordered searches — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's searches ordered" },
    ],
    opening: [
      { text: "The buyer's solicitor has placed the searches." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has ordered the property searches — the standard package of Local Authority, Drainage & Water, and Environmental, plus any area-specific ones. Buyers don't pay for searches until their solicitor has the funds in place, so this is one of the clearest commitment signals on the buyer's side.",
      },
    ],
    whatNext: [
      {
        text: "Results typically come back over the following 2–4 weeks. Your solicitor will field anything that flows from them, but if something material turns up (a planning matter, a drainage issue, anything the buyer's solicitor wants the seller's side to clarify), it'll come through as an enquiry — and your solicitor will reach you on any point that needs your input.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM8 complete: Searches ordered — {address}" },
    ],
    heroLabel: [
      { text: "PM8 — Searches ordered" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed searches ordered." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
