// Per-milestone chase-card copy for the Reminders page.
//
// Two agent-facing strings per milestone, distinct from the AI-prompt glossary
// (docs/chase-generation/MILESTONE_GLOSSARY.md, whose "outstanding" field is
// written for the chase model, not for an agent's eye):
//   step — the desktop step name, a fuller sentence-style heading than the terse
//          milestone name kept on mobile ("Memorandum of sale received by …").
//   line — the supporting sentence under the row, in a state-neutral voice so it
//          reads correctly whether we're auto-chasing it or it's the agent's.
//
// Both carry two tokens the caller fills from the file:
//   {Client Name(s)} — the side's principal(s), joined ("A & B"). Falls back to
//                      "the seller" / "the buyer" when no contact is named.
//   {Solicitor Firm} — the side's solicitor firm. Falls back to "the seller's
//                      solicitor" / "the buyer's solicitor" when none is on file.
//
// Singular vs plural: client-action milestones (where the client is the subject
// of the sentence) carry a separate `one` variant for a single client ("… needs
// …", {Client Name}); the base entry is the joint-client wording ("… need …",
// {Client Names}). Solicitor-subject milestones have one wording only — the firm
// is always treated as "need" — even where {Client Name(s)} appears as an object.
// The caller picks the variant from the count of named principals on the side.
//
// Lives here (not the glossary) because it's templated UI copy — a different
// concern from the four runtime glossary fields, and it must run client-side in
// the Reminders list (the glossary reads from disk, server-only). Copy is
// Ellis-authored; a Command Centre editor could sit on top of this map later.
//
// Source: founder-polished set, 2026-09-04 (plural + singular passes).

export interface ChaseCardCopy {
  step: string;
  line: string;
}

interface ChaseCardEntry extends ChaseCardCopy {
  // Single-client wording, used when the side has one named principal (or none —
  // the "the seller" / "the buyer" fallback reads as singular). Only present on
  // client-action milestones; absent means the base wording is used for any count.
  one?: ChaseCardCopy;
}

// Keyed by milestone code (VM1–VM21 seller side, PM1–PM27 buyer side).
export const CHASE_CARD_COPY: Record<string, ChaseCardEntry> = {
  // ── Seller side ──────────────────────────────────────────────────────────
  VM1:  {
    step: "Solicitor instructed for {Client Names}", line: "{Client Names} need to appoint a solicitor and provide their details so the memorandum of sale can be issued correctly.",
    one: { step: "Solicitor instructed for {Client Name}", line: "{Client Name} needs to appoint a solicitor and provide their details so the memorandum of sale can be issued correctly." },
  },
  VM2:  {
    step: "Memorandum of sale received by {Client Names}", line: "{Client Names} need to confirm they have received the memorandum of sale and that the details shown are correct.",
    one: { step: "Memorandum of sale received by {Client Name}", line: "{Client Name} needs to confirm they have received the memorandum of sale and that the details shown are correct." },
  },
  VM3:  { step: "Welcome pack issued by {Solicitor Firm}", line: "{Solicitor Firm} need to issue their welcome pack to {Client Names}, who should then confirm it has been received." },
  VM4:  {
    step: "ID and AML checks completed by {Client Names}", line: "{Client Names} need to complete the ID and anti-money-laundering checks required by {Solicitor Firm} before the legal work can properly get underway.",
    one: { step: "ID and AML checks completed by {Client Name}", line: "{Client Name} needs to complete the ID and anti-money-laundering checks required by {Solicitor Firm} before the legal work can properly get underway." },
  },
  VM5:  { step: "Property information forms issued to {Client Names}", line: "{Solicitor Firm} need to send the property information forms to {Client Names} so they can begin completing them." },
  VM6:  {
    step: "Property information forms returned to {Solicitor Firm}", line: "{Client Names} need to complete the property information forms and return them to {Solicitor Firm} so the draft contract pack can be prepared.",
    one: { step: "Property information forms returned by {Client Name}", line: "{Client Name} needs to complete the property information forms and return them to {Solicitor Firm} so the draft contract pack can be prepared." },
  },
  VM7:  { step: "Draft contract pack issued by {Solicitor Firm}", line: "{Solicitor Firm} need to issue the draft contract pack to the buyer's solicitor so the legal review and enquiry process can begin." },
  VM8:  { step: "Management pack requested by {Solicitor Firm}", line: "{Solicitor Firm} need to request the management pack from the freeholder or managing agent, as these can sometimes take several weeks to arrive." },
  VM9:  { step: "Management pack received by {Solicitor Firm}", line: "{Solicitor Firm} need to continue chasing the freeholder or managing agent until the outstanding management pack has been received." },
  VM10: { step: "Initial enquiries received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that the buyer's solicitor's initial enquiries have been received and are being reviewed." },
  VM11: {
    step: "Initial enquiry answers provided by {Client Names}", line: "{Client Names} need to provide {Solicitor Firm} with any information or answers required so they can respond to the buyer's initial enquiries.",
    one: { step: "Initial enquiry answers provided by {Client Name}", line: "{Client Name} needs to provide {Solicitor Firm} with any information or answers required so they can respond to the buyer's initial enquiries." },
  },
  VM12: { step: "Initial enquiry responses issued by {Solicitor Firm}", line: "{Solicitor Firm} need to send their formal responses to the buyer's solicitor once the necessary information has been gathered." },
  VM13: { step: "Additional enquiries received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that any additional enquiries from the buyer's solicitor have been received and are being reviewed." },
  VM14: {
    step: "Additional enquiry answers provided by {Client Names}", line: "{Client Names} need to provide {Solicitor Firm} with any further information required to resolve the additional enquiries.",
    one: { step: "Additional enquiry answers provided by {Client Name}", line: "{Client Name} needs to provide {Solicitor Firm} with any further information required to resolve the additional enquiries." },
  },
  VM15: { step: "Additional enquiry responses issued by {Solicitor Firm}", line: "{Solicitor Firm} need to send their responses to the buyer's solicitor so the remaining enquiries can be resolved." },
  VM16: { step: "Contract documents issued to {Client Names}", line: "{Solicitor Firm} need to issue the contract documents to {Client Names} so they can review and sign them." },
  VM17: {
    step: "Signed contract documents returned by {Client Names}", line: "{Client Names} need to sign the contract documents and return them to {Solicitor Firm}, as exchange cannot take place without the signed paperwork.",
    one: { step: "Signed contract documents returned by {Client Name}", line: "{Client Name} needs to sign the contract documents and return them to {Solicitor Firm}, as exchange cannot take place without the signed paperwork." },
  },
  VM18: { step: "{Solicitor Firm} confirmed ready to exchange", line: "{Solicitor Firm} need to confirm they are ready to exchange once all seller-side legal requirements have been completed." },
  VM19: {
    step: "Exchange confirmed for {Client Names}", line: "{Client Names} need to be told that contracts have exchanged and made aware of the agreed completion date.",
    one: { step: "Exchange confirmed for {Client Name}", line: "{Client Name} needs to be told that contracts have exchanged and made aware of the agreed completion date." },
  },
  VM20: {
    step: "Completion confirmed for {Client Names}", line: "{Client Names} need to be told that the sale has completed successfully.",
    one: { step: "Completion confirmed for {Client Name}", line: "{Client Name} needs to be told that the sale has completed successfully." },
  },
  VM21: { step: "All buyer enquiries confirmed satisfied", line: "The buyer's solicitor needs to confirm that all outstanding enquiries have been satisfactorily answered so the enquiry stage can be closed." },

  // ── Buyer side ───────────────────────────────────────────────────────────
  PM1:  {
    step: "Solicitor instructed for {Client Names}", line: "{Client Names} need to appoint a solicitor and provide their details so the purchase can begin properly.",
    one: { step: "Solicitor instructed for {Client Name}", line: "{Client Name} needs to appoint a solicitor and provide their details so the purchase can begin properly." },
  },
  PM2:  {
    step: "Memorandum of sale received by {Client Names}", line: "{Client Names} need to confirm they have received the memorandum of sale and that the details shown are correct.",
    one: { step: "Memorandum of sale received by {Client Name}", line: "{Client Name} needs to confirm they have received the memorandum of sale and that the details shown are correct." },
  },
  PM3:  {
    step: "ID and AML checks completed by {Client Names}", line: "{Client Names} need to complete the ID and anti-money-laundering checks required by {Solicitor Firm} before the legal work can properly get underway.",
    one: { step: "ID and AML checks completed by {Client Name}", line: "{Client Name} needs to complete the ID and anti-money-laundering checks required by {Solicitor Firm} before the legal work can properly get underway." },
  },
  PM4:  {
    step: "Money on account paid to {Solicitor Firm}", line: "{Client Names} need to pay the requested money on account to {Solicitor Firm} so searches can be ordered and the legal work can progress.",
    one: { step: "Money on account paid to {Solicitor Firm}", line: "{Client Name} needs to pay the requested money on account to {Solicitor Firm} so searches can be ordered and the legal work can progress." },
  },
  PM5:  {
    step: "Mortgage application submitted for {Client Names}", line: "{Client Names}, usually through their broker, need to submit the mortgage application so the lender can move on to valuation and underwriting.",
    one: { step: "Mortgage application submitted for {Client Name}", line: "{Client Name} needs to submit their mortgage application, usually through their broker, so the lender can move on to valuation and underwriting." },
  },
  PM6:  {
    step: "Lender valuation booked for {Client Names}", line: "{Client Names} or their broker need to confirm that the lender's valuation has been booked and is progressing.",
    one: { step: "Lender valuation booked for {Client Name}", line: "{Client Name} needs to confirm, either directly or through their broker, that the lender's valuation has been booked and is progressing." },
  },
  PM7:  { step: "Draft contract pack received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that the seller's draft contract pack has been received so their legal review can begin." },
  PM8:  { step: "Searches ordered by {Solicitor Firm}", line: "{Solicitor Firm} need to order the property searches so this part of the legal work can move forward without delay." },
  PM9:  {
    step: "Survey booked by {Client Names}", line: "{Client Names} need to arrange their survey or confirm that they have decided not to have one carried out.",
    one: { step: "Survey booked by {Client Name}", line: "{Client Name} needs to arrange their survey or confirm that they have decided not to have one carried out." },
  },
  PM10: {
    step: "Survey report received by {Client Names}", line: "{Client Names} need to confirm that their survey report has been received, or follow up with the surveyor if it is overdue.",
    one: { step: "Survey report received by {Client Name}", line: "{Client Name} needs to confirm that their survey report has been received, or follow up with the surveyor if it is overdue." },
  },
  PM11: {
    step: "Mortgage offer received for {Client Names}", line: "{Client Names} or their broker need to confirm when the mortgage offer is expected and flag any outstanding lender requirements or conditions.",
    one: { step: "Mortgage offer received for {Client Name}", line: "{Client Name} needs to confirm, either directly or through their broker, when the mortgage offer is expected and flag any outstanding lender requirements or conditions." },
  },
  PM12: { step: "Management pack received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that the management pack has been received from the seller's solicitor so it can be reviewed." },
  PM13: { step: "Search results received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm when the search results are expected and flag any delays if they remain outstanding." },
  PM14: { step: "Initial enquiries raised by {Solicitor Firm}", line: "{Solicitor Firm} need to raise their initial enquiries with the seller's solicitor so the enquiry process can begin." },
  PM15: { step: "Initial enquiry replies received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that the seller's initial replies have been received." },
  PM16: { step: "Initial enquiry replies reviewed by {Solicitor Firm}", line: "{Solicitor Firm} need to review the seller's replies and confirm whether they are satisfied or whether any further enquiries are required." },
  PM17: { step: "Additional enquiries raised by {Solicitor Firm}", line: "{Solicitor Firm} need to raise any further enquiries required, or confirm that they are satisfied and no additional enquiries are necessary." },
  PM18: { step: "Additional enquiry replies received by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that the seller's additional replies have been received." },
  PM19: { step: "Additional enquiry replies reviewed by {Solicitor Firm}", line: "{Solicitor Firm} need to review the additional replies and confirm whether they are satisfied and able to proceed." },
  PM20: { step: "All enquiries confirmed satisfied by {Solicitor Firm}", line: "{Solicitor Firm} need to confirm that all enquiries have been satisfactorily resolved so the matter can move into the final pre-exchange stage." },
  PM21: { step: "Final report issued to {Client Names}", line: "{Solicitor Firm} need to issue their final report to {Client Names}, who should then confirm it has been received." },
  PM22: { step: "Contract documents issued to {Client Names}", line: "{Solicitor Firm} need to issue the contract documents to {Client Names} so they can review and sign them." },
  PM23: {
    step: "Signed contract documents returned by {Client Names}", line: "{Client Names} need to sign the contract documents and return them to {Solicitor Firm}, as exchange cannot take place without the signed paperwork.",
    one: { step: "Signed contract documents returned by {Client Name}", line: "{Client Name} needs to sign the contract documents and return them to {Solicitor Firm}, as exchange cannot take place without the signed paperwork." },
  },
  PM24: {
    step: "Deposit transferred to {Solicitor Firm}", line: "{Client Names} need to transfer the exchange deposit to {Solicitor Firm} so cleared funds are available when exchange is authorised.",
    one: { step: "Deposit transferred to {Solicitor Firm}", line: "{Client Name} needs to transfer the exchange deposit to {Solicitor Firm} so cleared funds are available when exchange is authorised." },
  },
  PM25: { step: "{Solicitor Firm} confirmed ready to exchange", line: "{Solicitor Firm} need to confirm they are ready to exchange once all buyer-side legal and financial requirements have been completed." },
  PM26: {
    step: "Exchange confirmed for {Client Names}", line: "{Client Names} need to be told that contracts have exchanged and made aware of the agreed completion date.",
    one: { step: "Exchange confirmed for {Client Name}", line: "{Client Name} needs to be told that contracts have exchanged and made aware of the agreed completion date." },
  },
  PM27: {
    step: "Completion confirmed for {Client Names}", line: "{Client Names} need to be told that the purchase has completed and advised when and how the keys can be collected.",
    one: { step: "Completion confirmed for {Client Name}", line: "{Client Name} needs to be told that the purchase has completed and advised when and how the keys can be collected." },
  },
};

function capitaliseFirst(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fill(template: string, clientNames: string, solicitorFirm: string): string {
  return capitaliseFirst(
    template
      .replace(/\{Client Names\}/g, clientNames)
      .replace(/\{Client Name\}/g, clientNames)
      .replace(/\{Solicitor Firm\}/g, solicitorFirm),
  );
}

// Resolve a milestone's card copy with the file's client + solicitor filled in.
// Returns null when the code has no entry (caller falls back to the terse name).
// `singleClient` picks the singular wording where the milestone has one — pass
// true when the side has zero or one named principal (the generic "the seller" /
// "the buyer" fallback reads as singular too).
// `clientNames` / `solicitorFirm` should already carry their generic fallback
// ("the seller", "the buyer's solicitor") when nothing is named on the file.
export function renderChaseCardCopy(
  code: string | null | undefined,
  clientNames: string,
  solicitorFirm: string,
  singleClient: boolean,
): ChaseCardCopy | null {
  if (!code) return null;
  const raw = CHASE_CARD_COPY[code];
  if (!raw) return null;
  const variant = singleClient && raw.one ? raw.one : raw;
  return {
    step: fill(variant.step, clientNames, solicitorFirm),
    line: fill(variant.line, clientNames, solicitorFirm),
  };
}
