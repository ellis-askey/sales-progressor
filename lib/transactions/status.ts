// Single definition of "this sale is over" for signal gating (critiques 290/291:
// a withdrawn file still showed exchange-overdue and falling-behind banners, a
// fall-through risk score, chase prompts and amber progress tones). Terminal =
// fallen through (withdrawn) or completed — active-sale signals must not fire.
//
// Deliberately narrower than the various LIVE_STATUSES lists scattered through
// ingest/command code (those decide what can still RECEIVE data; this decides
// what should still NAG). draft and on_hold files keep their own handling.

import type { TransactionStatus } from "@prisma/client";

export function isTerminalSale(status: TransactionStatus | string): boolean {
  return status === "withdrawn" || status === "completed";
}
