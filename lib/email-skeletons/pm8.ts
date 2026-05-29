// PM8 — Buyer's solicitor has ordered searches.
//
// Non-bilateral. Applies to every shape (freehold + leasehold, all
// funding types). No shape variation per FINAL.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM8_SKELETON: MilestoneSkeleton = {

  vendor: {
    subject: [
      { text: "Buyer's solicitor has ordered searches, {address}" },
    ],
    heroLabel: [
      { text: "Searches ordered" },
    ],
    opening: [
      { text: "The buyer's solicitor has placed the property searches: the standard package of Local Authority, Drainage & Water, and Environmental, plus any area-specific ones. Buyers don't pay for searches until their solicitor has the funds in place, so this is one of the clearest commitment signals on the buyer's side." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Results take 2 to 4 weeks to come back. Your solicitor will field anything material that flows from them, and if a specific point needs your input (a planning matter, a drainage question, anything property-specific), they'll be in touch directly.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  purchaser: {
    subject: [
      { text: "Searches ordered, {address}" },
    ],
    heroLabel: [
      { text: "Searches ordered" },
    ],
    opening: [
      { text: "Your solicitor has ordered the property searches. The standard package covers the Local Authority search (planning, road adoption, restrictions, building control), a Drainage & Water search, and an Environmental search. Depending on the area, they may also order Chancel Repair, Coal Mining, or other location-specific searches." },
    ],
    whatHappened: [],
    whatNext: [
      {
        text: "Results take 2 to 4 weeks to come back, though the Local Authority search is often the slowest piece and can stretch longer in some areas. Your solicitor will review everything once it's all in and flag anything material. This one runs in the background while the enquiries side progresses.",
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
      { text: "Buyer's solicitor has confirmed ordering of property searches." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
