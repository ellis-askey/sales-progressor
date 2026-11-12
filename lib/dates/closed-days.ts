// Single source of truth for days the business is closed: England & Wales bank
// holidays, plus explicit closure windows (e.g. the Christmas shutdown). Before
// this module the same two concepts were copied across several files with
// different lists and different timezone bases, so a fix in one place silently
// missed the others. Everything that decides "is the office open" now reads from
// here: working-hours.ts (chases/reminders, London time), fees.ts (predicted
// exchange/completion dates), outboundQueue.ts (the send window), the direct
// senders, and the Exchange-day button.
//
// Weekends are intentionally NOT defined here: each caller already has its own
// weekday check on its own clock (London vs server-local), and this module
// stays purely about dates so it can be imported on the client too (the
// Exchange-day control uses it). Callers combine "is it a weekend?" with the
// key-based predicates below.
//
// Keys are "YYYY-MM-DD" strings; ISO date strings compare lexically in calendar
// order, so a closure window is a simple string range check.

// England & Wales bank holidays — current + next two years. One canonical copy
// (previously duplicated in working-hours.ts and fees.ts).
// Source: https://www.gov.uk/bank-holidays.json (england-and-wales division).
// EXTEND THIS before the last year listed runs out — otherwise late-in-range
// dates silently stop being holiday-aware.
export const BANK_HOLIDAYS_ENG_WALES: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
  "2026-08-31", "2026-12-25", "2026-12-28",
  // 2027
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31",
  "2027-08-30", "2027-12-27", "2027-12-28",
  // 2028
  "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29",
  "2028-08-28", "2028-12-25", "2028-12-26",
]);

// Inclusive closure windows [start, end]. The business is CLOSED on every
// calendar day in the range: all automated client contact pauses, and anything
// that would otherwise be scheduled or shown on one of these days rolls forward
// to the first open day after `end`.
//
// Christmas 2026: last working day Tue 22 Dec; closed Wed 23 Dec through Sun
// 3 Jan; reopen Mon 4 Jan 2027. ADD A NEW ENTRY each year — this is deliberately
// explicit, not computed, so the exact close/reopen dates are the founder's call.
export const CLOSURE_WINDOWS: ReadonlyArray<{ start: string; end: string; label: string }> = [
  { start: "2026-12-23", end: "2027-01-03", label: "Christmas 2026" },
];

export function isBankHolidayKey(key: string): boolean {
  return BANK_HOLIDAYS_ENG_WALES.has(key);
}

// Is this date inside a closure window (the Christmas shutdown)?
export function isClosureKey(key: string): boolean {
  for (const w of CLOSURE_WINDOWS) {
    if (key >= w.start && key <= w.end) return true;
  }
  return false;
}

// Day-level "not a normal working day for a reason other than the weekend" —
// a bank holiday OR inside a closure window. Weekends are the caller's own
// check (see the module note above).
export function isHolidayOrClosureKey(key: string): boolean {
  return isBankHolidayKey(key) || isClosureKey(key);
}
