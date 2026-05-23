// Hold-duration helpers — used everywhere the agent app does time-based
// reckoning on a transaction (on-track velocity, weeks elapsed, predicted
// exchange, days-since-stale, file-time tracker, future median calculations).
//
// The principle: when a file is on hold, the clock STOPS. Reactivation
// resumes from where it left off. So real elapsed time is split into
// "active" time (counts) and "hold" time (doesn't).
//
// Hold periods are tracked as TransactionHoldPeriod rows. Each row has a
// startedAt and an endedAt (null while the file is currently on hold).
// totalHoldMs sums closed periods + the open period's elapsed-so-far.
// activeElapsedMs is (now - createdAt) - totalHoldMs.

import type { TransactionStatus } from "@prisma/client";

export type HoldPeriodLite = {
  startedAt: Date;
  endedAt: Date | null;
};

export type HoldDurationInput = {
  status: TransactionStatus;
  holdPeriods: HoldPeriodLite[];
};

/**
 * Total milliseconds the file has spent on hold across all periods.
 * Includes the current open period (now - startedAt) when status is on_hold.
 *
 * Defensive: if status is on_hold but no open period exists in the input
 * (e.g. backfill missed it), we don't fabricate one — totalHoldMs just
 * returns the sum of closed periods. The caller's signals will still tick
 * (acceptable since this is a data-hygiene edge case, not a normal state).
 */
export function totalHoldMs(input: HoldDurationInput, now: Date = new Date()): number {
  let total = 0;
  for (const p of input.holdPeriods) {
    const end = p.endedAt ?? (input.status === "on_hold" ? now : null);
    if (!end) continue;
    const ms = end.getTime() - p.startedAt.getTime();
    if (ms > 0) total += ms;
  }
  return total;
}

/**
 * Milliseconds between createdAt and now, excluding any time spent on hold.
 * Use this anywhere we currently do `Date.now() - createdAt.getTime()` for
 * a time-elapsed signal.
 */
export function activeElapsedMs(
  createdAt: Date,
  input: HoldDurationInput,
  now: Date = new Date(),
): number {
  const raw = now.getTime() - createdAt.getTime();
  const hold = totalHoldMs(input, now);
  return Math.max(0, raw - hold);
}

/**
 * Convenience wrapper for "active weeks elapsed" — the common shape used by
 * the on_track velocity calc.
 */
export function activeWeeksElapsed(
  createdAt: Date,
  input: HoldDurationInput,
  now: Date = new Date(),
): number {
  return activeElapsedMs(createdAt, input, now) / (7 * 86400000);
}

/**
 * Convenience wrapper for "active days elapsed".
 */
export function activeDaysElapsed(
  createdAt: Date,
  input: HoldDurationInput,
  now: Date = new Date(),
): number {
  return activeElapsedMs(createdAt, input, now) / 86400000;
}
