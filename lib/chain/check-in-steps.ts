// The closed set of "Confirm progress" steps on a chain check-in row
// (critique #235): the basic conveyancing beats an agent hears have happened on
// a neighbour's sale. Completable in any order; the two finale steps (contracts
// signed and returned on each side) are the exchange-readiness signal — when
// every step is marked, the node is flagged ready to exchange
// (ChainLink.exchangeReadyConfirmedAt, the same field the push-to-exchange
// surface reads). Keys are stored in ChainNodeStepMark.stepKey — never rename
// a key without migrating stored rows.

export type CheckInStep = {
  key: string;
  label: string;
  // Compact label for the milestone-line node (two short lines max). Falls
  // back to `label` when absent. `label` stays canonical for log entries.
  shortLabel?: string;
  // The grand-finale pair: the exchange-readiness signal, visually distinct.
  finale: boolean;
};

export const CHECK_IN_STEPS: readonly CheckInStep[] = [
  { key: "dcp_issued", label: "DCP issued", finale: false },
  { key: "searches_ordered", label: "Searches ordered", finale: false },
  // Buyer's finance in place (mortgage offer / proof of funds) — slots between
  // searches ordered and received (critique #283). New key, so existing marks are
  // untouched; it simply reads unmarked until confirmed.
  { key: "finances_arranged", label: "Finances arranged", finale: false },
  { key: "searches_received", label: "Searches received", finale: false },
  { key: "enquiries_raised", label: "Enquiries raised", finale: false },
  { key: "enquiries_satisfied", label: "Enquiries satisfied", finale: false },
  { key: "contracts_issued", label: "Contracts issued", finale: false },
  { key: "seller_signed_returned", label: "Seller signed & returned", shortLabel: "Seller signed", finale: true },
  { key: "buyer_signed_returned", label: "Buyer signed & returned", shortLabel: "Buyer signed", finale: true },
] as const;

export const CHECK_IN_STEP_KEYS = new Set(CHECK_IN_STEPS.map((s) => s.key));

export function checkInStepLabel(key: string): string | null {
  return CHECK_IN_STEPS.find((s) => s.key === key)?.label ?? null;
}

// The "last update" sentence for a confirmed check-in step (critique #286):
// "{who} received confirmation from {agency} that {clause}." Reviewed on
// /dev/chain-checkin-update before wiring. PROPOSED wording — awaiting sign-off.
const CONFIRMATION_CLAUSE: Record<string, string> = {
  dcp_issued: "the draft contract pack has been issued",
  searches_ordered: "searches have been ordered",
  finances_arranged: "finances have been arranged",
  searches_received: "the search results have been received",
  enquiries_raised: "enquiries have been raised",
  enquiries_satisfied: "all enquiries have been satisfied",
  contracts_issued: "contracts have been issued",
  seller_signed_returned: "the seller has signed and returned their contract",
  buyer_signed_returned: "the buyer has signed and returned their contract",
};

export function checkInConfirmationLine(
  stepKey: string,
  confirmerName: string,
  agencyName: string | null,
): string {
  const clause = CONFIRMATION_CLAUSE[stepKey] ?? checkInStepLabel(stepKey)?.toLowerCase() ?? stepKey;
  const from = agencyName ? ` from ${agencyName}` : "";
  return `${confirmerName} received confirmation${from} that ${clause}.`;
}

// The single line a bulk "Confirm ready" logs (critique #297). Same shape as the
// per-step line, with a whole-node clause instead of one step's: "{who} received
// confirmation from {agency} that their sale is ready to exchange."
export function checkInReadyConfirmationLine(
  confirmerName: string,
  agencyName: string | null,
): string {
  const from = agencyName ? ` from ${agencyName}` : "";
  return `${confirmerName} received confirmation${from} that their sale is ready to exchange.`;
}
