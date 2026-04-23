// Client-facing copy for portal milestone display
// Labels and descriptions written from the buyer/seller's perspective

export type PortalCopy = {
  label: string;
  who: "you" | "solicitor" | "agent" | "lender";
  typicalDuration?: string;
};

const copy: Record<string, PortalCopy> = {
  // ── Vendor milestones ────────────────────────────────────────────────────
  VM1:  { label: "Instruct your solicitor",                  who: "you" },
  VM2:  { label: "Receive memorandum of sale",               who: "solicitor" },
  VM3:  { label: "Receive welcome pack from solicitor",      who: "you" },
  VM14: { label: "Complete ID & AML checks",                 who: "you" },
  VM15: { label: "Receive property information forms",       who: "you" },
  VM4:  { label: "Return completed property forms",          who: "you" },
  VM5:  { label: "Draft contract pack issued",               who: "solicitor" },
  VM6:  { label: "Management pack requested",                who: "solicitor" },
  VM7:  { label: "Management pack received",                 who: "solicitor", typicalDuration: "can take 4–8 weeks" },
  VM16: { label: "Initial enquiries received",               who: "solicitor" },
  VM17: { label: "Provide replies to enquiries",             who: "you" },
  VM8:  { label: "Replies sent to buyer's solicitor",        who: "solicitor" },
  VM18: { label: "Additional enquiries received",            who: "solicitor" },
  VM19: { label: "Provide additional replies",               who: "you" },
  VM9:  { label: "Additional replies sent",                  who: "solicitor" },
  VM10: { label: "Contract documents issued to you",         who: "solicitor" },
  VM11: { label: "Sign and return contract documents",       who: "you" },
  VM20: { label: "Solicitor confirms ready to exchange",     who: "solicitor", typicalDuration: "typically 1–5 days after signing" },
  VM12: { label: "Contracts exchanged",                      who: "agent" },
  VM13: { label: "Sale completed",                           who: "agent" },

  // ── Purchaser milestones ─────────────────────────────────────────────────
  PM1:  { label: "Instruct your solicitor",                  who: "you" },
  PM2:  { label: "Receive memorandum of sale",               who: "solicitor" },
  PM14a:{ label: "Complete ID & AML checks",                 who: "you" },
  PM15a:{ label: "Pay money on account to solicitor",        who: "you" },
  PM4:  { label: "Submit mortgage application",              who: "you" },
  PM5:  { label: "Lender valuation booked",                  who: "lender",    typicalDuration: "usually 1–2 weeks after application" },
  PM3:  { label: "Draft contract pack received",             who: "solicitor" },
  PM9:  { label: "Searches ordered",                         who: "solicitor", typicalDuration: "results in 2–6 weeks" },
  PM7:  { label: "Book your survey",                         who: "you" },
  PM20: { label: "Survey report received",                   who: "you" },
  PM6:  { label: "Mortgage offer received",                  who: "lender",    typicalDuration: "typically 1–3 weeks after valuation" },
  PM8:  { label: "Management pack received",                 who: "solicitor" },
  PM10: { label: "Search results received",                  who: "solicitor", typicalDuration: "usually 2–6 weeks" },
  PM11: { label: "Initial enquiries raised",                 who: "solicitor" },
  PM21: { label: "Initial replies received",                 who: "solicitor" },
  PM22: { label: "Initial replies reviewed",                 who: "solicitor" },
  PM12: { label: "Additional enquiries raised",              who: "solicitor" },
  PM23: { label: "Additional replies received",              who: "solicitor" },
  PM24: { label: "Additional replies reviewed",              who: "solicitor" },
  PM25: { label: "All enquiries satisfied",                  who: "solicitor" },
  PM26: { label: "Final report received from solicitor",     who: "you" },
  PM13: { label: "Contract documents issued to you",         who: "solicitor" },
  PM14b:{ label: "Sign and return contract documents",       who: "you" },
  PM15b:{ label: "Transfer the deposit",                     who: "you" },
  PM27: { label: "Solicitor confirms ready to exchange",     who: "solicitor", typicalDuration: "typically 1–5 days after signing" },
  PM16: { label: "Contracts exchanged",                      who: "agent" },
  PM17: { label: "Purchase completed",                       who: "agent" },
};

export function getMilestoneCopy(code: string): PortalCopy {
  return copy[code] ?? { label: code, who: "solicitor" };
}

export const WHO_LABELS: Record<string, string> = {
  you:       "You",
  solicitor: "Your solicitor",
  agent:     "Your agent",
  lender:    "Your lender",
};
