// Onward-purchase voice.
//
// How each purchaser (PM) step reads when we're speaking to a SELLER about the
// property THEY are buying (their onward purchase), in the second person. This is
// deliberately DISTINCT from lib/portal-copy.ts, which is written to the actual
// buyer of a file — reusing that copy is what made the onward steps read wrong
// ("Buyer has instructed their solicitor" to a seller). Q7: Ellis approves this
// copy before it ships. Spec: docs/active/onward-visibility/00-discovery.md.

export type OnwardStepCopy = { label: string; subtext?: string };

export const ONWARD_STEP_COPY: Record<string, OnwardStepCopy> = {
  PM1:  { label: "You've instructed your solicitor", subtext: "They'll handle the legal work for your purchase." },
  PM2:  { label: "The memorandum of sale has been issued", subtext: "This confirms the sale details and gets the legal process underway." },
  PM3:  { label: "You've completed your ID and money laundering checks", subtext: "Your solicitor has completed the checks they need to act for you." },
  PM4:  { label: "You've paid your funds on account", subtext: "This covers the initial costs your solicitor pays on your behalf." },
  PM5:  { label: "You've submitted your mortgage application", subtext: "Your lender can now start assessing your application." },
  PM6:  { label: "Your lender has booked the valuation", subtext: "They'll check the property provides suitable security for the mortgage." },
  PM7:  { label: "Your solicitor has received the draft contract pack", subtext: "The seller's solicitor has sent across the legal paperwork for the property." },
  PM8:  { label: "Your solicitor has ordered your searches", subtext: "These check things like the local area, drainage and environmental matters." },
  PM9:  { label: "You've booked your survey", subtext: "Your surveyor will inspect the property and flag any concerns." },
  PM10: { label: "You've received your survey report", subtext: "You can now review the property's condition and any issues raised." },
  PM11: { label: "Your solicitor has received your mortgage offer", subtext: "Your lender has formally confirmed the mortgage they're prepared to offer." },
  PM12: { label: "Your solicitor has received the management pack", subtext: "This contains important information about the management of the property." },
  PM13: { label: "Your solicitor has received your search results", subtext: "They can now review the results and raise any questions that come from them." },
  PM14: { label: "Your solicitor has raised their enquiries", subtext: "These are the legal questions they need the seller's side to answer." },
  PM20: { label: "Your solicitor is satisfied with the enquiries", subtext: "The legal questions raised on your purchase have now been resolved." },
  PM21: { label: "Your solicitor has sent you their final report", subtext: "This brings together the key legal information you need before exchange." },
  PM22: { label: "Your solicitor has sent you the contract to sign", subtext: "You'll need to sign and return this before you can exchange." },
  PM23: { label: "You've returned your signed contract", subtext: "Your solicitor now has your signed contract ready for exchange." },
  PM24: { label: "You've sent your deposit to your solicitor", subtext: "Your solicitor now has the deposit they'll need for exchange." },
  PM25: { label: "You're ready to exchange", subtext: "Everything is in place on your purchase for contracts to be exchanged." },
  PM26: { label: "You've exchanged contracts on your purchase", subtext: "Your purchase is now legally binding and the completion date is fixed." },
  PM27: { label: "You've completed your purchase", subtext: "The property is officially yours and it's time to collect the keys." },
};

export function onwardStepLabel(code: string, fallback: string): string {
  return ONWARD_STEP_COPY[code]?.label ?? fallback;
}

export function onwardStepSubtext(code: string): string | undefined {
  return ONWARD_STEP_COPY[code]?.subtext;
}
