// lib/billing/period.ts
//
// Billing-period boundary computation, anchored to Europe/London.
//
// Storage stays UTC (Invoice.monthStart is a Date column, all timestamps
// are UTC instants). But the RULE for which billing month an exchange falls
// into uses London time. Otherwise an exchange at 00:30 on the 1st (London)
// lands on last month's invoice (UTC says it's still the previous month),
// which is a trust-eroding billing query.
//
// Uses Intl.DateTimeFormat with the IANA `Europe/London` zone so DST is
// handled by the platform's tz database — no manual BST/GMT logic, no new
// runtime dependency.
//
// Returns a Date that represents the INSTANT corresponding to "midnight on
// the 1st of the relevant London month". That instant in UTC might be
// 23:00 on the last day of the previous month during BST.

/**
 * Given any Date (interpreted as an instant in time), return the UTC Date
 * for "midnight on the 1st of the same Europe/London calendar month".
 *
 * Examples:
 *   - 2026-01-15T08:00:00Z (mid-January UTC, mid-January London too)
 *     → 2026-01-01T00:00:00Z (Jan 1 midnight London = same instant in UTC,
 *       because London is on GMT in January)
 *
 *   - 2026-05-15T08:00:00Z (mid-May UTC, mid-May London on BST)
 *     → 2026-04-30T23:00:00Z (May 1 midnight London = April 30 23:00 UTC,
 *       because London is on BST = UTC+1 in May)
 *
 *   - 2026-05-01T00:30:00Z (00:30 May 1 UTC = 01:30 May 1 London BST)
 *     → 2026-04-30T23:00:00Z (Same May 1 midnight London → April 30 23:00 UTC)
 *
 *   - 2026-04-30T23:30:00Z (23:30 Apr 30 UTC = 00:30 May 1 London BST)
 *     This instant is already in MAY in London. So → 2026-04-30T23:00:00Z
 *     (May 1 midnight London → April 30 23:00 UTC). Confirmed: the 00:30
 *     May 1 London exchange correctly lands on the May invoice.
 */
export function billingMonthStart(d: Date): Date {
  // Step 1 — Determine the London calendar year and month for instant `d`.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const monthOneBased = Number(parts.find((p) => p.type === "month")!.value);

  // Step 2 — Find the UTC instant for "midnight on the 1st" of that London
  // month. We pick a candidate noon-UTC on day 1, ask what hour it shows
  // in London, and derive the offset. Noon avoids DST ambiguity at midnight.
  const candidateNoonUtc = Date.UTC(year, monthOneBased - 1, 1, 12, 0, 0);
  const londonHourAtNoonUtc = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(candidateNoonUtc)),
  );
  const londonOffsetHours = londonHourAtNoonUtc - 12; // 0 in GMT, 1 in BST

  // London midnight on day 1 corresponds to UTC = midnight − offsetHours.
  return new Date(Date.UTC(year, monthOneBased - 1, 1, 0, 0, 0) - londonOffsetHours * 3_600_000);
}

/**
 * Return [monthStart, nextMonthStart) — the UTC half-open interval for the
 * London calendar month containing `d`. Useful for `WHERE billedAtExchange >=
 * monthStart AND billedAtExchange < nextMonthStart` queries on the live
 * running total.
 */
export function billingMonthRange(d: Date): { start: Date; end: Date } {
  const start = billingMonthStart(d);
  // Add a generous offset (32 days) to land somewhere in the next London
  // month, then take that month's start. 32 days is always > the longest
  // calendar month and < two months, so we land in the correct following
  // month regardless of DST shifts.
  const intoNext = new Date(start.getTime() + 32 * 24 * 3_600_000);
  const end = billingMonthStart(intoNext);
  return { start, end };
}
