// PM1 — Buyer has instructed their solicitor.
//
// Universal first step on the buyer side. Mirror of VM1 but for the
// purchaser. Shape relevance:
//   - Funding: only mortgage buyers have a parallel mortgage application
//     to keep moving — the "what next" funding paragraph branches.
//   - Tenure: a buyer-side leasehold heads-up so they understand why the
//     management pack timeline is a thing.
//
// No bilateral pair — single fan-out. No route/direction conditioning.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM1_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: the buyer who just instructed their solicitor ──────────
  purchaser: {
    subject: [
      { text: "You've instructed your solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Solicitor instructed" },
    ],
    opening: [
      { text: "You've taken the first step." },
    ],
    whatHappened: [
      {
        text: "You've formally instructed your solicitor to act on your purchase. They'll now contact you with a welcome pack, their terms of business, and details of what they need from you to get started.",
      },
    ],
    whatNext: [
      // Universal — return-the-welcome-pack + ID is the foundational ask.
      {
        text: "Return your solicitor's welcome pack and complete your ID checks as quickly as possible — your solicitor cannot begin substantive work on your purchase until both are in place.",
      },
      // Mortgage variant — the other early piece to keep moving.
      {
        text: "If you haven't already submitted your mortgage application, that's the other early piece to push on. Your lender will need to instruct their valuation as part of the application, so the sooner that goes in, the sooner the financing side starts moving.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds variant — the equity-from-sale dependency.
      // Opens "Your deposit…" not "Because…" so when it stacks with the
      // leasehold paragraph below on Leasehold × CFP, the two add-ons
      // don't both lead with the same conjunction.
      {
        text: "Your deposit comes from your concurrent sale, so keep us posted on progress over there — that sale's exchange is the gating step for your purchase's exchange, and your solicitor will want to be aware of how it's moving.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Tenure addendum — leasehold heads-up. Opens "One thing worth
      // flagging…" so when it stacks with the CFP paragraph above on
      // Leasehold × CFP, the cadence varies between the two add-ons
      // and the email doesn't read as a mechanical "Because… Because…"
      // list.
      {
        text: "One thing worth flagging on the leasehold side — you'll see a management pack come into the process. That's leasehold-specific paperwork from the freeholder, and it often takes several weeks to come back on its own clock. Worth knowing now so it's not a surprise later.",
        when: { tenure: "leasehold" },
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: seller hearing the buyer's side has kicked off ────────────
  vendor: {
    subject: [
      { text: "The buyer has instructed their solicitor — {address}" },
    ],
    heroLabel: [
      { text: "Buyer's solicitor instructed" },
    ],
    opening: [
      { text: "The buyer is now formally instructed." },
    ],
    whatHappened: [
      {
        text: "The buyer has formally instructed their solicitor to act on the purchase. Conveyancing is now underway on the buyer's side.",
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now. We'll keep you updated as the buyer's side progresses through the early steps — ID checks, mortgage application if applicable, and payment on account to their solicitor.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log, shape-stable ────────────────────────────
  progressor: {
    subject: [
      { text: "PM1 complete: Buyer instructed solicitor — {address}" },
    ],
    heroLabel: [
      { text: "PM1 — Buyer instructed solicitor" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser has confirmed solicitor instruction." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
