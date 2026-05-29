// PM1 — Buyer has instructed their solicitor.
//
// Non-bilateral, no route/direction conditioning.
//   - Vendor side branches on purchaseType: cash buyers get a "no mortgage,
//     removes a delay source" line; mortgage buyers get the parallel-
//     mortgage-application framing; cash-from-proceeds gets the related-
//     sale framing.
//   - Purchaser side branches on purchaseType: mortgage adds the
//     "now's the time to push on the mortgage application" paragraph;
//     cash-from-proceeds adds the related-sale gating paragraph.
//
// Source: FINAL email matrix.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM1_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: the buyer who just instructed their solicitor ──────────
  purchaser: {
    subject: [
      { text: "Your solicitor's instructed, {address}" },
    ],
    heroLabel: [
      { text: "Solicitor instructed" },
    ],
    opening: [
      { text: "Your solicitor's instructed. That's the start of conveyancing on your purchase." },
    ],
    whatHappened: [
      // Cash buyer + mortgage version — full welcome-pack framing line.
      {
        text: "They'll be in touch shortly with their welcome pack: terms of business, ID requirements, and the first forms you'll need to fill in. Get those back as soon as you can. Your solicitor can't start substantive work until they have your ID cleared and your payment on account.",
        when: { purchaseType: { in: ["cash_buyer", "mortgage"] } },
      },
      // Cash-from-proceeds — short welcome-pack line; the related-sale
      // paragraph below replaces the universal "get those back" closer.
      {
        text: "They'll be in touch shortly with their welcome pack: terms of business, ID requirements, and the first forms you'll need to fill in.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    whatNext: [
      // Mortgage variant — push on the application.
      {
        text: "If you haven't already started your mortgage application, now's the time. The sooner it's in, the sooner the lender's valuation and formal offer follow, and the financing side moves in parallel with the conveyancing.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds variant — the related-sale gating paragraph.
      {
        text: "Because your deposit comes from your related sale, that sale has to exchange before this purchase can. The two are tied together at that point. Keep us posted on how the related sale is progressing. Your solicitor will be coordinating the timing of both, and the more visibility everyone has on the other side, the smoother that coordination is.",
        when: { purchaseType: "cash_from_proceeds" },
      },
      // Cash buyer has no whatNext paragraph — the body ends at the
      // welcome-pack closer in whatHappened.
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: seller hearing the buyer's side has kicked off ────────────
  vendor: {
    subject: [
      { text: "The buyer's solicitor is instructed, {address}" },
    ],
    heroLabel: [
      { text: "Buyer's solicitor instructed" },
    ],
    opening: [
      { text: "The buyer's solicitor is instructed. Both sides are now formally in motion." },
    ],
    whatHappened: [
      // Cash buyer — no mortgage to arrange.
      {
        text: "The buyer's next steps are their ID checks and getting funds on account with their solicitor, which covers the cost of searches and disbursements during conveyancing. The buyer is purchasing in cash, so there's no mortgage to arrange. That removes one of the most common sources of delay and uncertainty in a sale.",
        when: { purchaseType: "cash_buyer" },
      },
      // Mortgage — parallel mortgage-application framing.
      {
        text: "The buyer's next steps are their ID checks, getting funds on account with their solicitor, and submitting their mortgage application. The mortgage runs in parallel with the conveyancing: application, then the lender's valuation, then the formal offer. We'll keep you posted as the financing side progresses.",
        when: { purchaseType: "mortgage" },
      },
      // Cash-from-proceeds — related sale framing.
      {
        text: "The buyer's next steps are their ID checks and getting funds on account with their solicitor, which covers the cost of searches and disbursements during conveyancing. They're funding this purchase from their own sale's equity, so their related sale is running alongside this one, and their solicitor will be coordinating both transactions.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],
    whatNext: [
      {
        text: "Nothing for you to do right now. The next thing you'll see on your side is the welcome pack from your solicitor.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  // ── Progressor: internal log, shape-stable (preserved unchanged) ──────
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
