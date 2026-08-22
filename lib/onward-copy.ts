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
  PM1:  { label: "You've instructed your solicitor", subtext: "The solicitor handling the place you're buying." },
  PM2:  { label: "You've had the memorandum of sale", subtext: "The paperwork that starts your purchase off." },
  PM3:  { label: "You've passed your ID and anti-money-laundering checks" },
  PM4:  { label: "You've paid money on account", subtext: "Funds your solicitor holds to cover early costs." },
  PM5:  { label: "You've applied for your mortgage" },
  PM6:  { label: "Your lender has booked the valuation", subtext: "The lender checks the property is worth the loan." },
  PM7:  { label: "Your solicitor has the draft contract", subtext: "Sent over by the seller's solicitor." },
  PM8:  { label: "Your solicitor has ordered the searches", subtext: "Local authority, water and environmental checks." },
  PM9:  { label: "You've booked your survey" },
  PM10: { label: "You've had your survey report back" },
  PM11: { label: "Your solicitor has your mortgage offer", subtext: "The formal offer from your lender." },
  PM12: { label: "Your solicitor has the management pack", subtext: "Leasehold information from the freeholder or managing agent." },
  PM13: { label: "Your solicitor has the search results back" },
  PM14: { label: "Your solicitor has raised enquiries", subtext: "Questions for the seller's side about the property." },
  PM20: { label: "Your enquiries are all answered", subtext: "Every question from your solicitor has been resolved." },
  PM21: { label: "You've had your solicitor's report on the property" },
  PM22: { label: "Your solicitor has sent you the contract to sign" },
  PM23: { label: "You've returned your signed contract" },
  PM24: { label: "You've sent your deposit to your solicitor" },
  PM25: { label: "You're ready to exchange", subtext: "Everything's in place on your purchase." },
  PM26: { label: "You've exchanged on your onward purchase", subtext: "Contracts are binding. This happens alongside your sale." },
  PM27: { label: "You've completed your onward purchase", subtext: "The keys are yours." },
};

export function onwardStepLabel(code: string, fallback: string): string {
  return ONWARD_STEP_COPY[code]?.label ?? fallback;
}

export function onwardStepSubtext(code: string): string | undefined {
  return ONWARD_STEP_COPY[code]?.subtext;
}
