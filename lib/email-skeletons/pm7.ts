// PM7 — Buyer's solicitor has received the draft contract pack.
//
// Spike skeleton authored in Model B (composition). The proof spike for
// whether per-paragraph conditional sections assemble into prose that
// reads as polished as a hand-written email.
//
// PM7 exercises all three condition dimensions:
//   • tenure       — leasehold-only paragraph re. the management pack
//                    arriving separately
//   • purchaseType — three branches of the "what's the other thing in
//                    flight while enquiries run" sentence (mortgage /
//                    cash buyer / cash from proceeds)
//   • route        — three confirmer paths for the acted-side (purchaser)
//                    acknowledgement opening
//
// And the inverse direction:
//   • direction=inverse — vendor receives a hand-off nudge when PM7
//                          confirms before VM7 (buyer's sol logged
//                          receipt before seller's sol logged dispatch)
//
// Recipient set (matches existing PM7 emailCopy in lib/portal-copy.ts):
//   purchaser (acted-side ack — varies by route × shape)
//   vendor    (inverse-direction hand-off nudge — varies by shape)
//   progressor (universal internal log — shape-stable)
//   no vendorAgent variant (matches current code — no change in this spike)

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM7_SKELETON: MilestoneSkeleton = {

  // ── Purchaser: acted-side acknowledgement ─────────────────────────────
  //
  // Fires when PM7 itself is confirmed. Opening varies by who clicked:
  // first-person "you've confirmed" for client-via-portal; third-person
  // "we've recorded that your solicitor" for agent/SP on behalf.
  // whatHappened universal. whatNext branches on funding (the previous
  // flat-string assumed mortgage; this fixes that for cash buyers and
  // cash-from-proceeds buyers). Leasehold note added to whatHappened.
  purchaser: {
    subject: [
      {
        text: "You've confirmed the contract pack has arrived — {address}",
        when: { route: "client_portal" },
      },
      {
        text: "The contract pack is with your solicitor — {address}",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    heroLabel: [
      { text: "Contract pack received" },
    ],

    opening: [
      {
        text: "Thanks — your solicitor has the draft contract pack from the seller's solicitor.",
        when: { route: "client_portal" },
      },
      {
        text: "Your solicitor now has everything they need to start the legal review — the draft contract pack has arrived from the seller's solicitor.",
        when: { route: { in: ["agent", "sales_progressor"] } },
      },
    ],

    whatHappened: [
      // Universal — the substantive description of the event. Note:
      // trimmed in v2 to drop the trailing "and start raising enquiries"
      // mention, because whatNext's universal first paragraph already
      // covers that — and across every assembled shape both sections fire,
      // so the original was a duplication every reader saw.
      {
        text: "That's the bundle of documents that forms the legal foundation of your purchase — the draft contract, title documents, property information forms, and any relevant certificates. Your solicitor will now review everything carefully.",
      },
      // Leasehold addendum — separate paragraph, only on leasehold files.
      {
        text: "The management pack from the freeholder is a separate delivery — that can take several weeks longer to arrive than the rest of the contract pack, and your solicitor will fold it into the enquiries when it lands.",
        when: { tenure: "leasehold" },
      },
    ],

    whatNext: [
      // Universal — the "your solicitor will work through it" + searches
      // reminder. Applies on every shape.
      {
        text: "Your solicitor will work through the contract pack and raise enquiries with the seller's side. If you haven't already ordered searches, make sure that's in hand — your solicitor needs your payment on account before they can do so.",
      },
      // Mortgage variant — calls out the mortgage application + survey.
      {
        text: "In parallel, keep your mortgage application and survey progressing — both want to be moving while the enquiries are in flight.",
        when: { purchaseType: "mortgage" },
      },
      // Cash buyer variant — drops the mortgage reference, keeps survey.
      {
        text: "In parallel, your survey is the other big thing in flight — make sure that's progressing while the enquiries are out.",
        when: { purchaseType: "cash_buyer" },
      },
      // Cash-from-proceeds variant — survey + the concurrent-sale deposit
      // dependency, which is the real gating step for this funding shape.
      {
        text: "In parallel, your survey is the other piece in flight — and your concurrent sale's exchange is the gating step on your end, since your deposit comes from those proceeds.",
        when: { purchaseType: "cash_from_proceeds" },
      },
    ],

    action: [
      { text: "View your portal" },
    ],
  },

  // ── Vendor: inverse-direction hand-off nudge ──────────────────────────
  //
  // Fires when PM7 confirms BEFORE VM7 — i.e. the buyer's sol logged
  // receipt before the seller's sol logged dispatch. The platform infers
  // the seller's side dispatched the pack (you can't receive what wasn't
  // sent) and asks the seller to log it on their portal.
  //
  // Direction-stable: this vendor body only fires under direction=inverse.
  // When direction=default (VM7 confirmed first), VM7 fires its own
  // vendor ack via VM7's skeleton, and this nudge doesn't apply.
  //
  // Shape variation: leasehold adds a note about the management pack
  // being a separate moving piece, so the seller is primed to expect it
  // arriving on its own clock.
  vendor: {
    subject: [
      {
        text: "Please confirm the contract pack has gone out — {address}",
        when: { direction: "inverse" },
      },
    ],

    heroLabel: [
      { text: "Contract pack received by buyer", when: { direction: "inverse" } },
    ],

    opening: [
      {
        text: "The buyer's solicitor has already logged receipt of the draft contract pack on their side — so it sounds like your solicitor sent it across as planned, even if that hasn't reached us yet.",
        when: { direction: "inverse" },
      },
    ],

    whatHappened: [
      {
        text: "If you've got ten seconds, open your portal and confirm you're aware the pack has been sent — the button's already highlighted and waiting. That brings our records back in step with theirs.",
        when: { direction: "inverse" },
      },
    ],

    whatNext: [
      // Universal forward-look: enquiries are next.
      {
        text: "The buyer's solicitor will be reviewing the pack now and is likely to raise enquiries in the next week or two. Your solicitor will handle those — expect them to come to you directly on any specific point that needs your read.",
        when: { direction: "inverse" },
      },
      // Leasehold addendum — separate paragraph.
      {
        text: "If you're selling a leasehold, the management pack from your freeholder is a separate moving piece. Your solicitor will let you know when it's in.",
        when: { direction: "inverse", tenure: "leasehold" },
      },
    ],

    action: [
      { text: "Open your portal", when: { direction: "inverse" } },
    ],
  },

  // ── Progressor: internal log (shape-stable, single body) ──────────────
  //
  // Mirrors the existing PM7 progressor variant verbatim. No shape or
  // route conditioning — internal audience reads codes and short factual
  // bodies; they don't need shape-specific framing.
  progressor: {
    subject: [
      { text: "PM7 complete: Contract pack received — {address}" },
    ],
    heroLabel: [
      { text: "PM7 — Draft contract pack received" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Buyer's solicitor has confirmed receipt of draft contract pack." },
    ],
    // No whatNext for progressor — by convention.
    action: [
      { text: "View transaction" },
    ],
  },
};
