// Related-sale voice.
//
// How each vendor (VM) step reads when we're speaking to a BUYER about the
// property THEY are selling (their "related sale", the chain link below them), in
// the second person. The buyer is the SELLER on this sale, so we track the
// selling (VM) steps and word them from the seller's point of view about "your
// sale". Mirror of lib/onward-copy.ts (which speaks to a seller about their
// onward purchase). Deliberately DISTINCT from lib/portal-copy.ts.
//
// Copy signed off by Ellis 2026-08-29 (Law 21). Spec: docs/active/related-sale/00-spec.md.
// Displayed set = vendor defs minus retired enquiry codes (VM11-VM15), i.e.
// VM1-VM10, VM16-VM21. VM8/VM9 show for leasehold only.

export type RelatedSaleStepCopy = { label: string; subtext?: string };

export const RELATED_SALE_STEP_COPY: Record<string, RelatedSaleStepCopy> = {
  VM1:  { label: "You've instructed your solicitor", subtext: "They'll handle the legal side of the property you're selling." },
  VM2:  { label: "The memorandum of sale has been issued", subtext: "This confirms your sale's details and gets the legal process going." },
  VM3:  { label: "You've had the welcome pack from your solicitor", subtext: "The paperwork to get your sale started has arrived." },
  VM4:  { label: "You've done your ID and money-laundering checks", subtext: "Your solicitor has what they need to act on your sale." },
  VM5:  { label: "Your solicitor has sent you the property forms", subtext: "The forms about the property you're selling are ready to fill in." },
  VM6:  { label: "You've returned your completed property forms", subtext: "Your solicitor can now put the contract pack together for your buyer's side." },
  VM7:  { label: "Your solicitor has issued the draft contracts", subtext: "The legal pack for your sale has gone to your buyer's solicitor." },
  VM8:  { label: "Your solicitor has requested the management pack", subtext: "For a leasehold sale, this gathers what the buyer's side needs." },
  VM9:  { label: "Your solicitor has received the management pack", subtext: "Now on its way to your buyer's solicitor." },
  VM10: { label: "Your buyer's solicitor has raised enquiries", subtext: "These are the legal questions your side now answers." },
  VM21: { label: "The enquiries on your sale are answered", subtext: "The legal questions on your sale have been resolved." },
  VM16: { label: "Your solicitor has sent you the contract to sign", subtext: "Sign and return this and your sale can move to exchange." },
  VM17: { label: "You've returned your signed contract", subtext: "Your solicitor has your signed contract ready for exchange." },
  VM18: { label: "Your sale is ready to exchange", subtext: "Everything's in place on your sale for contracts to exchange." },
  VM19: { label: "You've exchanged contracts on your sale", subtext: "Your sale is now legally binding and the completion date is set." },
  VM20: { label: "You've completed your sale", subtext: "Your sale is done and the funds are released." },
};

export function relatedSaleStepLabel(code: string, fallback: string): string {
  return RELATED_SALE_STEP_COPY[code]?.label ?? fallback;
}

export function relatedSaleStepSubtext(code: string): string | undefined {
  return RELATED_SALE_STEP_COPY[code]?.subtext;
}
