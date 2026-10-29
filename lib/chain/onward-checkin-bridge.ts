// Bridges a related-sale / onward-purchase milestone confirmation (the
// OnwardTracker / OnwardStepConfirmation model) onto the chain check-in row for
// that same node: it maps the fine PM/VM milestone to one of the 9 coarse
// CHECK_IN_STEPS beats and composes the "Last update" line.
//
// Two line shapes (wording signed off 2026-10-28):
//   • client confirmed — "{Client} confirmed {solicitor} have ordered the searches."
//   • agent confirmed  — "{Agent} received confirmation that {solicitor} have ordered the searches."
//
// Note we never say "confirmation FROM the solicitor" — we don't necessarily
// hear it from them; the firm is the ACTOR inside the clause instead.
//
// The solicitor firm is named when we hold it — which is always the case on the
// side our own client is on (our buyer's solicitor on their related sale, our
// seller's solicitor on their onward purchase). It drops to "their solicitor"
// (client line) or to the neutral passive clause with no firm (agent line) when
// we don't: the far side of the node, or no solicitor recorded on the file.
// Firms take the collective plural ("Dutton Gregory have …"); the "their
// solicitor" fallback is singular ("their solicitor has …").
//
// Only the 9 beats bridge. Signing is the client's own act and finance is the
// lender, so those two client lines carry no firm.

export type OnwardSide = "vendor" | "purchaser";
export type OnwardConfirmSource = "agent" | "seller" | "buyer";

// Milestone code → check-in beat, by the side the tracker reports on.
// Vendor = the sale's seller side; Purchaser = its buyer side. A given tracker
// only ever covers one side, so each node's 9 beats split across our-side
// (firm known) and far-side (neutral) trackers.
const VENDOR_STEP_FROM_CODE: Record<string, string> = {
  VM7: "dcp_issued",
  VM10: "enquiries_raised",
  VM16: "contracts_issued",
  VM17: "seller_signed_returned",
  VM21: "enquiries_satisfied",
};
const PURCHASER_STEP_FROM_CODE: Record<string, string> = {
  PM7: "dcp_issued",
  PM8: "searches_ordered",
  PM11: "finances_arranged",
  PM13: "searches_received",
  PM14: "enquiries_raised",
  PM20: "enquiries_satisfied",
  PM22: "contracts_issued",
  PM23: "buyer_signed_returned",
};

// The check-in beat a confirmed milestone maps to, or null if it isn't one of
// the 9 bridged beats (most onboarding / survey / notice milestones aren't).
export function checkInStepForMilestone(side: OnwardSide, milestoneCode: string): string | null {
  const map = side === "vendor" ? VENDOR_STEP_FROM_CODE : PURCHASER_STEP_FROM_CODE;
  return map[milestoneCode] ?? null;
}

// The beats where the solicitor firm is the actor ("{firm} have ordered the
// searches"). Finance (the lender) and signing (the client's own act) are not.
const FIRM_ACTION = new Set<string>([
  "dcp_issued", "searches_ordered", "searches_received",
  "enquiries_raised", "enquiries_satisfied", "contracts_issued",
]);

// The participle phrase after "{subject} has/have …" for a firm-action beat.
function firmActionRest(stepKey: string, side: OnwardSide): string {
  switch (stepKey) {
    case "dcp_issued": return side === "vendor" ? "issued the draft contract pack" : "received the draft contract pack";
    case "searches_ordered": return "ordered the searches";
    case "searches_received": return "received the search results";
    case "enquiries_raised": return side === "vendor" ? "received initial enquiries" : "raised initial enquiries";
    case "enquiries_satisfied": return "cleared all enquiries";
    case "contracts_issued": return "sent out the contract to sign";
    default: return stepKey;
  }
}

// The neutral passive clause (no actor) — used on an agent line when the firm is
// unknown (far side), and for the two non-firm beats everywhere.
function neutralClause(stepKey: string, side: OnwardSide): string {
  switch (stepKey) {
    case "dcp_issued": return side === "vendor" ? "the draft contract pack has been issued" : "the draft contract pack has been received";
    case "searches_ordered": return "searches have been ordered";
    case "finances_arranged": return "finances are in place";
    case "searches_received": return "the search results are back";
    case "enquiries_raised": return side === "vendor" ? "enquiries have been received" : "enquiries have been raised";
    case "enquiries_satisfied": return "all enquiries are satisfied";
    case "contracts_issued": return "contracts have been issued";
    case "seller_signed_returned": return "the seller has signed and returned their contract";
    case "buyer_signed_returned": return "the buyer has signed and returned their contract";
    default: return stepKey;
  }
}

// The clause after "{Client} confirmed " in a CLIENT line. Firm-action beats put
// the firm (or "their solicitor") as the subject; signing is the client's own
// act and finance the lender.
function clientClause(stepKey: string, side: OnwardSide, solicitorName: string | null): string {
  if (stepKey === "finances_arranged") return "their mortgage offer has come through";
  if (stepKey === "seller_signed_returned" || stepKey === "buyer_signed_returned") return "they've signed and returned their contract";
  const subject = solicitorName ?? "their solicitor";
  const verb = solicitorName ? "have" : "has"; // named firm → collective plural; "their solicitor" → singular
  return `${subject} ${verb} ${firmActionRest(stepKey, side)}`;
}

// Compose the check-in "Last update" line for a bridged confirmation.
//   source "agent"           → "{Agent} received confirmation that {firm} have …"
//                              (neutral passive when the firm is unknown)
//   source "seller"/"buyer"  → "{Client} confirmed {firm} have …"
export function onwardCheckInLine(input: {
  stepKey: string;
  side: OnwardSide;
  source: OnwardConfirmSource;
  confirmerName: string;
  solicitorName: string | null;
}): string {
  const { stepKey, side, source, confirmerName, solicitorName } = input;
  if (source === "agent") {
    if (FIRM_ACTION.has(stepKey) && solicitorName) {
      return `${confirmerName} received confirmation that ${solicitorName} have ${firmActionRest(stepKey, side)}.`;
    }
    return `${confirmerName} received confirmation that ${neutralClause(stepKey, side)}.`;
  }
  return `${confirmerName} confirmed ${clientClause(stepKey, side, solicitorName)}.`;
}
