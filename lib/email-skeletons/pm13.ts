// PM13 — Buyer's solicitor has received the search results.
//
// Second of two searches milestones. PM8 owns the "what's in the
// searches bundle" explainer; this body refers to "the searches" /
// "the results" without re-listing — the paired-read check on
// PM8 → PM13 would otherwise flag the bundle composition as repeated
// to the same reader.
//
// Funding conditioning: mortgage-only variant on the buyer-side
// whatNext. Lender implications of search findings is a genuine
// mortgage-nudge moment (unlike the PM3 ID-checks attempt, which felt
// forced) — search-flagged issues like flood risk, planning matters,
// or environmental concerns can genuinely affect underwriting. Cash
// buyers and cash-from-proceeds buyers don't have that constraint, so
// no add-on fires for them; the universal paragraph carries the
// "read the results carefully" advice that applies to everyone.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM13_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Search results are back with your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Search results in" },
    ],
    opening: [
      { text: "Your search results are with your solicitor." },
    ],
    whatHappened: [
      {
        text: "Your solicitor has now received the search results and will review them. Most files come back clean or with minor administrative notes; occasionally something material turns up — a planning matter, a road that hasn't been formally adopted, a drainage issue, an environmental flag — that needs to be looked into before exchange.",
      },
    ],
    whatNext: [
      // Universal — the "read what's flagged" agent-voice advice.
      {
        text: "If your solicitor flags anything significant to you, read what's in the report carefully and ask questions before deciding how to proceed. Most findings are workable — either the seller's side answers an enquiry that satisfies the point, an indemnity policy covers it, or the issue is one buyers reasonably accept. But it's worth knowing what you're accepting and why.",
      },
      // Mortgage variant — genuine lender consideration. Searches feed
      // back into underwriting on a mortgage file in a way they don't
      // on cash purchases.
      {
        text: "One thing worth knowing if you're on a mortgage: your lender may want to see how any material findings are being resolved before they're comfortable releasing funds. That's not unusual — your solicitor will handle the lender liaison if it comes up — but it's worth knowing search findings can ripple into the offer side, not just the conveyancing side.",
        when: { purchaseType: "mortgage" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's solicitor has the search results — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's searches back" },
    ],
    opening: [
      { text: "The buyer's search results are in." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has now received the search results and will review them. Most files come back without surprises; occasionally something the searches flag turns into an enquiry the buyer's side wants the seller's side to clarify.",
      },
    ],
    whatNext: [
      // PM8 vendor whatNext already explained the "if material → enquiry
      // → may need your input" mechanism when searches were ordered.
      // Restating it here would mean the seller reads the same forward-
      // look paragraph twice, 3–4 weeks apart. This body focuses on the
      // present moment — review is happening now — and keeps only the
      // distinctive agent-voice detail about what kinds of things the
      // seller might be asked.
      {
        text: "The buyer's solicitor's review usually takes a few days to a week. Any enquiries flowing from the results will land soon after — if anything needs seller-side input only you can answer (planning history you remember, drainage you've maintained, anything property-specific), your solicitor will reach you.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM13 complete: Search results received — {address}" },
    ],
    heroLabel: [
      { text: "PM13 — Search results received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed receipt of search results." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
