// Approved confirmation subtexts — the one-line progress note shown beneath the
// confirmation sentence on a milestone card in the Activity tab. Keyed by
// milestone code + confirmer bucket. Copy locked by Ellis 2026-09-01; source is
// docs/active/confirmation-subtexts/ (final approved copy). This file is
// display copy only — it must not be reworded during implementation.
//
// Confirmer buckets:
//   A = client or a helper confirming on their behalf (portal self-confirm)
//   B = team (agency staff or Sales Progressor) logged it
//   C = solicitor confirmed via their update link
//   D = auto (no named person; only VM21 / PM20, which close as a twin)
// A missing bucket = no subtext for that confirmer (the doc's "N/A").

import type { UpdateConfirmer } from "@/lib/updates-copy";

export type ConfirmerBucket = "A" | "B" | "C" | "D";

const SUBTEXTS: Record<string, Partial<Record<ConfirmerBucket, string>>> = {
  // ── Seller side ──────────────────────────────────────────────────────────
  VM1: {
    A: "The solicitor is now in place, so their details can be included on the memorandum of sale.",
    B: "The solicitor is now in place, so their details can be included on the memorandum of sale.",
  },
  VM2: {
    A: "The seller now has the agreed sale details and solicitor information.",
    B: "The seller now has the agreed sale details and solicitor information.",
  },
  VM3: {
    A: "The seller has their solicitor's opening paperwork, so we're now waiting for their onboarding requirements to be completed.",
    B: "The seller has their solicitor's opening paperwork, so we're now waiting for their onboarding requirements to be completed.",
  },
  VM4: {
    A: "The seller's initial checks are complete, so their solicitor can continue with the legal work.",
    B: "The seller's initial checks are complete, so their solicitor can continue with the legal work.",
  },
  VM5: {
    A: "The forms are with the seller, so we're now waiting for them to be completed and returned.",
    B: "The forms are with the seller, so we're now waiting for them to be completed and returned.",
    C: "The forms are with the seller, so we're now waiting for them to be completed and returned.",
  },
  VM6: {
    A: "The completed forms are back with the seller's solicitor, ready for the draft contract pack to be prepared.",
    B: "The completed forms are back with the seller's solicitor, ready for the draft contract pack to be prepared.",
  },
  VM7: {
    A: "The draft pack is now with the buyer's solicitor for review.",
    B: "The draft pack is now with the buyer's solicitor for review.",
    C: "The draft pack is now with the buyer's solicitor for review.",
  },
  VM8: {
    A: "The request is now with the freeholder or managing agent, so we're waiting for the pack to come back.",
    B: "The request is now with the freeholder or managing agent, so we're waiting for the pack to come back.",
    C: "The request is now with the freeholder or managing agent, so we're waiting for the pack to come back.",
  },
  VM9: {
    A: "The management pack is in and can now be sent across to the buyer's solicitor.",
    B: "The management pack is in and can now be sent across to the buyer's solicitor.",
    C: "The management pack is in and can now be sent across to the buyer's solicitor.",
  },
  VM10: {
    B: "The first enquiries are now with the seller's solicitor, so we're waiting for their replies.",
  },
  VM11: {
    A: "The seller's replies are with their solicitor, ready to be sent across to the buyer's side.",
    B: "The seller's replies are with their solicitor, ready to be sent across to the buyer's side.",
  },
  VM12: {
    B: "The first replies are now back with the buyer's solicitor for review.",
  },
  VM13: {
    B: "The further enquiries are now with the seller's solicitor, so we're waiting for their replies.",
  },
  VM14: {
    A: "The seller's further replies are with their solicitor, ready to be sent across to the buyer's side.",
    B: "The seller's further replies are with their solicitor, ready to be sent across to the buyer's side.",
  },
  VM15: {
    B: "The further replies are now back with the buyer's solicitor for review.",
  },
  VM16: {
    A: "The contract is with the seller, so we're now waiting for the signed copy to go back to their solicitor.",
    B: "The contract is with the seller, so we're now waiting for the signed copy to go back to their solicitor.",
    C: "The contract is with the seller, so we're now waiting for the signed copy to come back.",
  },
  VM17: {
    A: "The signed contract is back with the seller's solicitor and in place ahead of exchange.",
    B: "The signed contract is back with the seller's solicitor and in place ahead of exchange.",
    C: "The signed contract is back with the seller's solicitor and in place ahead of exchange.",
  },
  VM18: {
    A: "Everything is ready on the seller's side, so we're now waiting for the buyer's solicitor to reach the same point.",
    B: "Everything is ready on the seller's side, so we're now waiting for the buyer's solicitor to reach the same point.",
    C: "Everything is ready on the seller's side, so we're now waiting for the buyer's solicitor to reach the same point.",
  },
  VM19: {
    A: "Contracts have exchanged and the sale is legally binding. Completion is now the next step.",
    B: "Contracts have exchanged and the sale is legally binding. Completion is now the next step.",
  },
  VM20: {
    A: "Completion has taken place and the sale is now complete.",
    B: "Completion has taken place and the sale is now complete.",
  },
  VM21: {
    B: "Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.",
    D: "Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.",
  },

  // ── Buyer side ───────────────────────────────────────────────────────────
  PM1: {
    A: "The solicitor is now in place, so the seller's side has somewhere to send the contract pack.",
    B: "The solicitor is now in place, so the seller's side has somewhere to send the contract pack.",
  },
  PM2: {
    A: "The buyer now has the agreed sale details and solicitor information.",
    B: "The buyer now has the agreed sale details and solicitor information.",
  },
  PM3: {
    A: "The buyer's initial checks are complete, so their solicitor can continue with the legal work.",
    B: "The buyer's initial checks are complete, so their solicitor can continue with the legal work.",
  },
  PM4: {
    A: "The initial payment is with the buyer's solicitor, so searches can now be ordered when they're ready.",
    B: "The initial payment is with the buyer's solicitor, so searches can now be ordered when they're ready.",
  },
  PM5: {
    A: "The mortgage application is in, so we're now waiting for the lender to progress it.",
    B: "The mortgage application is in, so we're now waiting for the lender to progress it.",
  },
  PM6: {
    A: "The valuation is booked and the mortgage application is continuing with the lender.",
    B: "The valuation is booked and the mortgage application is continuing with the lender.",
  },
  PM7: {
    A: "The draft pack is now with the buyer's solicitor for review.",
    B: "The draft pack is now with the buyer's solicitor for review.",
    C: "The draft pack is now with the buyer's solicitor for review.",
  },
  PM8: {
    A: "The searches are underway, so we're now waiting for the results to come back.",
    B: "The searches are underway, so we're now waiting for the results to come back.",
    C: "The searches are underway, so we're now waiting for the results to come back.",
  },
  PM9: {
    A: "The survey is booked, so we'll now wait for the appointment and report.",
    B: "The survey is booked, so we'll now wait for the appointment and report.",
  },
  PM10: {
    A: "The buyer has their report, so we'll see whether anything comes back from the survey.",
    B: "The buyer has their report, so we'll see whether anything comes back from the survey.",
  },
  PM11: {
    A: "The formal mortgage offer is now with the buyer's solicitor and in place ahead of exchange.",
    B: "The formal mortgage offer is now with the buyer's solicitor and in place ahead of exchange.",
    C: "The formal mortgage offer is now in and in place ahead of exchange.",
  },
  PM12: {
    A: "The management pack is now with the buyer's solicitor for review.",
    B: "The management pack is now with the buyer's solicitor for review.",
    C: "The management pack is now in for review.",
  },
  PM13: {
    A: "The search results are back with the buyer's solicitor and are now being reviewed.",
    B: "The search results are back with the buyer's solicitor and are now being reviewed.",
    C: "The search results are back and are now being reviewed.",
  },
  PM14: {
    B: "The first enquiries are now with the seller's solicitor, so we're waiting for their replies.",
  },
  PM15: {
    B: "The first replies are back with the buyer's solicitor and are now being reviewed.",
  },
  PM16: {
    B: "The first replies have been reviewed, so we're waiting to see whether anything further is needed.",
  },
  PM17: {
    B: "Further enquiries are now with the seller's solicitor, so we're waiting for their replies.",
  },
  PM18: {
    B: "The further replies are back with the buyer's solicitor and are now being reviewed.",
  },
  PM19: {
    B: "The further replies have been reviewed, so we're now waiting for confirmation that enquiries are satisfied.",
  },
  PM20: {
    B: "Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.",
    D: "Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.",
  },
  PM21: {
    A: "The final report is with the buyer, so we're now waiting for the remaining pre-exchange steps to be completed.",
    B: "The final report is with the buyer, so we're now waiting for the remaining pre-exchange steps to be completed.",
  },
  PM22: {
    A: "The contract is with the buyer, so we're now waiting for the signed copy to go back to their solicitor.",
    B: "The contract is with the buyer, so we're now waiting for the signed copy to go back to their solicitor.",
    C: "The contract is with the buyer, so we're now waiting for the signed copy to come back.",
  },
  PM23: {
    A: "The signed contract is back with the buyer's solicitor and in place ahead of exchange.",
    B: "The signed contract is back with the buyer's solicitor and in place ahead of exchange.",
    C: "The signed contract is back with the buyer's solicitor and in place ahead of exchange.",
  },
  PM24: {
    A: "The deposit is with the buyer's solicitor and in place ahead of exchange.",
    B: "The deposit is with the buyer's solicitor and in place ahead of exchange.",
  },
  PM25: {
    A: "Everything is ready on the buyer's side, so we're now waiting for the seller's solicitor to reach the same point.",
    B: "Everything is ready on the buyer's side, so we're now waiting for the seller's solicitor to reach the same point.",
    C: "Everything is ready on the buyer's side, so we're now waiting for the seller's solicitor to reach the same point.",
  },
  PM26: {
    A: "Contracts have exchanged and the purchase is legally binding. Completion is now the next step.",
    B: "Contracts have exchanged and the purchase is legally binding. Completion is now the next step.",
  },
  PM27: {
    A: "Completion has taken place and the purchase is now complete.",
    B: "Completion has taken place and the purchase is now complete.",
  },
};

// Map the resolved confirmer to its display bucket. Null (a genuine system /
// auto confirm, e.g. the VM21/PM20 twin close) is bucket D.
export function confirmerBucket(confirmer: UpdateConfirmer | null): ConfirmerBucket {
  if (!confirmer) return "D";
  if (confirmer.kind === "client" || confirmer.kind === "helper") return "A";
  if (confirmer.kind === "solicitor") return "C";
  return "B"; // agent (team member / Sales Progressor)
}

// The approved subtext for a completed milestone, or null when that
// code/confirmer pairing has no line ("N/A"). Callers must not render a
// subtext on skipped (not_required) steps — those are out of scope.
export function confirmationSubtext(code: string, bucket: ConfirmerBucket): string | null {
  return SUBTEXTS[code]?.[bucket] ?? null;
}
