// The one-time calendar→working-day value conversion for chase timings
// (critique #281, business-days step 3, founder-approved table 2026-10-20).
//
// From step 3 on, ReminderRule.graceDays / repeatEveryDays (and their agency /
// business / per-file-snapshot copies) COUNT WORKING DAYS. Stored values are
// converted once by scripts/convert-chase-timings-to-working-days.ts using this
// mapping, chosen so real-world durations stay as close as possible to what
// they were under calendar counting:
//
//   0-3 unchanged  (these were the weekend-landing problem; counting them in
//                   working days IS the fix)
//   4+  × 5/7, rounded to the nearest day:
//       5→4  7→5  10→7  12→9  14→10  21→15  28→20
//
// Pure and tested (lib/reminders/__tests__/working-day-conversion.test.ts) —
// the script imports this so the tested function is the one that runs.

export function calendarToWorkingDays(n: number): number {
  if (!Number.isFinite(n) || n < 0) return n;
  if (n <= 3) return n;
  return Math.round((n * 5) / 7);
}
