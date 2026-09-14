// lib/portal/chase-echo-copy.ts
// Side-aware wording for the passive portal updates we post when someone chases
// a solicitor or a client, or logs an enquiry movement. Pure + client-safe (no
// server imports) so it can be unit-tested and shared.
//
// Reviewed with Ellis 2026-09-14 (the phrasing matrix). Voice rules (Law 21):
// no em-dashes, no exclamation marks, "we'll" over "the system".
//
// Who sees what (driven by the chase recipient, decided at the call site):
//   - Solicitor chased  -> BOTH sides get a line (own side reads "your
//     solicitor", the other reads the role). Both name the firm.
//   - Client chased      -> only the OTHER side gets a line; the chased client
//     gets nothing (they received the chase directly).

export type EchoSide = "vendor" | "purchaser";

const sideRole = (side: EchoSide): "seller" | "buyer" => (side === "vendor" ? "seller" : "buyer");

// The "about X" clause per solicitor step. `own` is what the owning side reads,
// `other` what the opposite side reads; where they match, only `other` is set.
const SOLICITOR_ABOUT: Record<string, { other: string; own?: string }> = {
  VM5:  { other: "the property information forms" },
  VM7:  { other: "issuing the draft contract pack" },
  VM8:  { other: "requesting the management pack" },
  VM9:  { other: "the management pack", own: "the management pack coming back" },
  VM16: { other: "getting the contract out for signing", own: "getting your contract out to sign" },
  VM17: { other: "the signed contract coming back", own: "returning your signed contract" },
  VM18: { other: "confirming they're ready to exchange" },
  PM7:  { other: "reviewing the contract pack" },
  PM8:  { other: "getting the searches ordered" },
  PM13: { other: "the search results", own: "the search results coming back" },
  PM11: { other: "the mortgage offer", own: "your mortgage offer" },
  PM12: { other: "the management pack" },
  PM22: { other: "getting the contract out for signing", own: "getting your contract out to sign" },
  PM23: { other: "the signed contract coming back", own: "returning your signed contract" },
  PM25: { other: "confirming they're ready to exchange" },
};

// The "about X" clause per client step (other side only). Falls back to the
// step's human label when a code isn't curated here.
const CLIENT_ABOUT: Record<string, string> = {
  VM4:  "completing their ID checks",
  PM3:  "completing their ID checks",
  VM6:  "returning their property information forms",
  PM4:  "putting funds with their solicitor",
  PM5:  "their mortgage application",
  PM9:  "booking their survey",
  PM24: "transferring their deposit",
  VM17: "signing and returning their contract",
  PM23: "signing and returning their contract",
};

// True when we have specific wording for a solicitor step. When false the caller
// should skip the echo rather than post a vague line.
export function hasSolicitorEchoCopy(code: string): boolean {
  return code in SOLICITOR_ABOUT;
}

// True when we have specific wording for a client step. Client echoes only fire
// for curated steps, so we never post a vague "about their next step" line.
export function hasClientEchoCopy(code: string): boolean {
  return code in CLIENT_ABOUT;
}

// The line each side sees when we chase a solicitor.
//   viewerSide  – whose portal is reading it
//   chasedSide  – which solicitor we actually chased (vendor = seller's)
//   firmName    – the solicitor firm, or null to omit the appositive
export function solicitorChaseLine(opts: {
  code: string;
  viewerSide: EchoSide;
  chasedSide: EchoSide;
  firmName: string | null;
}): string | null {
  const about = SOLICITOR_ABOUT[opts.code];
  if (!about) return null;
  const isOwn = opts.viewerSide === opts.chasedSide;
  const clause = (isOwn && about.own) ? about.own : about.other;
  const firm = opts.firmName?.trim();
  const who = isOwn
    ? (firm ? `your solicitor, ${firm},` : "your solicitor")
    : (firm ? `the ${sideRole(opts.chasedSide)}'s solicitor, ${firm},` : `the ${sideRole(opts.chasedSide)}'s solicitor`);
  return `We've followed up with ${who} about ${clause}.`;
}

// The line the OTHER side sees when we chase a client directly. `stepLabel` is a
// human fallback (e.g. the milestone short name) used when the code isn't curated.
export function clientChaseLine(opts: {
  code: string;
  chasedSide: EchoSide;
  stepLabel: string | null;
}): string {
  const party = `the ${sideRole(opts.chasedSide)}`;
  const about = CLIENT_ABOUT[opts.code] ?? (opts.stepLabel ? opts.stepLabel.trim().toLowerCase() : "their next step");
  return `We've followed up with ${party} about ${about}.`;
}

export type EnquiryEchoKind = "replies_sent" | "partial_replies" | "raised";

// The line each side sees for an enquiry movement. Direction is fixed per kind:
// replies_sent / partial are the seller's side sending replies out; raised is the
// buyer's side asking more. Returns null for a kind we don't echo.
export function enquiryEchoLine(kind: EnquiryEchoKind, viewerSide: EchoSide): string | null {
  const V = viewerSide === "vendor";
  switch (kind) {
    case "replies_sent":
      return V
        ? "Your solicitor has sent their replies to the buyer's solicitor's enquiries."
        : "The seller's solicitor has sent replies to your solicitor's enquiries.";
    case "partial_replies":
      return V
        ? "Your solicitor has sent over some of the replies to the buyer's enquiries, with more to follow."
        : "Some replies have come back from the seller's side, with more to follow.";
    case "raised":
      return V
        ? "The buyer's solicitor has raised some further enquiries with your solicitor."
        : "Your solicitor has raised some further enquiries with the seller's side.";
  }
}
