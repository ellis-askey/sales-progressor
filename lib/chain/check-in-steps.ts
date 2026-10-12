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
