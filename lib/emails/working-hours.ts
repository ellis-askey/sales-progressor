// Working-hours scheduler for client-facing transactional sends that must
// not deliver outside working hours, on weekends, or on England + Wales
// bank holidays. Distinct from lib/email/outboundQueue.ts:scheduleForBusinessHours
// (which uses an 08:00–19:00 Mon–Fri window without holiday awareness) —
// kept separate so the existing chain-notification scheduling stays
// untouched and our client intro can apply a stricter definition.
//
// Window: 09:00–17:00 Europe/London, Monday–Friday, excluding the
// England + Wales public holidays in BANK_HOLIDAYS below.
//
// Behaviour:
//   - If `now` falls inside the window → return `now` (send immediately).
//   - Otherwise → return the start of the next working day at 09:00 London
//     (handles BST/GMT transitions correctly via Intl.DateTimeFormat).
//
// Bank holidays AND closure windows (the Christmas shutdown) now live in one
// shared place — lib/dates/closed-days.ts — so this module, the send window,
// the fee/prediction dates and the direct senders all agree on which days the
// office is closed. A working day here is Mon–Fri, not a bank holiday, and not
// inside a closure window.
import {
  BANK_HOLIDAYS_ENG_WALES,
  isHolidayOrClosureKey,
  isClosureKey,
} from "@/lib/dates/closed-days";

const WORKING_HOURS_OPEN  = 9;   // 09:00 London
const WORKING_HOURS_CLOSE = 17;  // 17:00 London

// London "today" parts: returns date components (numeric) interpreted in
// Europe/London. Important: never read .getHours() / .getDay() on a Date —
// those are server-local and the server runs UTC, so they'd be wrong in
// BST and partly wrong in GMT.
function londonParts(d: Date): { year: number; month: number; day: number; hour: number; weekday: number } {
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const hourFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    hour: "2-digit", hour12: false,
  });
  // Day-of-week: Intl returns full names; we map to 0=Sun..6=Sat.
  const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
  });
  const weekdayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  };
  const [y, m, day] = dateFmt.format(d).split("-").map(Number);
  const hour = parseInt(hourFmt.format(d), 10);
  const weekday = weekdayMap[weekdayFmt.format(d)] ?? 0;
  return { year: y, month: m - 1, day, hour, weekday };
}

// "YYYY-MM-DD" key in Europe/London for bank-holiday lookup.
function londonDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// A "working day" = Monday–Friday AND not a bank holiday AND not inside a
// closure window (the Christmas shutdown). London calendar throughout.
export function isWorkingDay(d: Date): boolean {
  const { weekday } = londonParts(d);
  if (weekday === 0 || weekday === 6) return false; // Sun/Sat
  if (isHolidayOrClosureKey(londonDateKey(d))) return false;
  return true;
}

// True when `d` falls inside a closure window (the Christmas shutdown), judged
// on the London calendar. Used by senders that normally run on days a plain
// working-day check would allow (e.g. the Saturday weekly update) but must
// still fall silent over the shutdown.
export function isClosureDay(d: Date = new Date()): boolean {
  return isClosureKey(londonDateKey(d));
}

// True when `d` is a bank holiday OR inside a closure window (not weekends).
// Used by the 24/7 senders that should also respect bank holidays.
export function isHolidayOrClosureDay(d: Date = new Date()): boolean {
  return isHolidayOrClosureKey(londonDateKey(d));
}

// London Mon–Fri check (weekday only). Matches the chase crons' Vercel
// schedule ("… 1-5"), which fires Monday–Friday INCLUDING bank holidays — so
// this is deliberately NOT isWorkingDay (which also drops bank holidays). Used
// to decide when a predicted chase will actually go out, so the Automated-emails
// page never says "sending today" on a weekend.
export function isLondonWeekday(d: Date = new Date()): boolean {
  const { weekday } = londonParts(d);
  return weekday !== 0 && weekday !== 6;
}

// The London day the chase crons will NEXT run, on or after `from`: `from`
// itself when that's a weekday, else the following Monday. Weekday-only (bank
// holidays still send). Returns a Date inside that day at `from`'s clock time —
// suitable for day-key / day-label formatting, not as a precise send instant.
export function nextChaseSendDay(from: Date = new Date()): Date {
  let cursor = new Date(from.getTime());
  for (let i = 0; i < 7; i++) {
    if (isLondonWeekday(cursor)) return cursor;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return cursor; // unreachable (a weekday always falls within 7 days)
}

// Build a UTC instant that corresponds to a target London local hour on
// the given UTC year/month/day. Tries the three plausible UTC hours and
// picks the one whose London-rendering matches. Robust across BST/GMT
// boundary days.
function londonHourAsUTC(year: number, month: number, day: number, londonHour: number): Date {
  // London is UTC+0 or UTC+1, so candidate UTC hour is londonHour-1 or londonHour.
  for (const utcHour of [londonHour - 1, londonHour, londonHour + 1]) {
    const candidate = new Date(Date.UTC(year, month, day, utcHour, 0, 0, 0));
    const renderedHour = parseInt(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/London",
        hour: "2-digit", hour12: false,
      }).format(candidate),
      10,
    );
    if (renderedHour === londonHour) return candidate;
  }
  // Defensive fallback — should be unreachable.
  return new Date(Date.UTC(year, month, day, londonHour, 0, 0, 0));
}

// Return the start of the next working day at 09:00 London (as a UTC
// Date). Walks forward day-by-day until a non-weekend, non-holiday day
// is found. Bounded — gives up after a fortnight (should never trigger;
// guards against a malformed BANK_HOLIDAYS table swallowing every day).
function nextWorkingDayAt9am(from: Date): Date {
  let cursor = new Date(from.getTime());
  for (let i = 0; i < 20; i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (isWorkingDay(cursor)) {
      const { year, month, day } = londonParts(cursor);
      return londonHourAsUTC(year, month, day, WORKING_HOURS_OPEN);
    }
  }
  // Worst-case fallback — emit a stale-but-finite timestamp so callers see
  // the bug rather than silently never delivering.
  const { year, month, day } = londonParts(cursor);
  return londonHourAsUTC(year, month, day, WORKING_HOURS_OPEN);
}

/**
 * Returns the date N working days after `from` — skipping weekends and
 * England & Wales bank holidays (via isWorkingDay). N=0 returns a copy of
 * `from` unchanged. Used by the solicitor-chase cadence: "first nudge 5
 * working days after a step falls due". Bounded loop guards a malformed
 * holiday table.
 */
export function addWorkingDays(from: Date, n: number): Date {
  const result = new Date(from);
  let added = 0;
  let guard = 0;
  while (added < n && guard < 400) {
    result.setUTCDate(result.getUTCDate() + 1);
    guard++;
    if (isWorkingDay(result)) added++;
  }
  return result;
}

/**
 * How many WORKING days have elapsed between two instants — weekends and E&W
 * bank holidays excluded, judged on the London calendar like everything else
 * in this module. Counts working days in (from, to]: same London day = 0, the
 * next working day = 1. The working-day twin of client-chase-cron's
 * daysBetween, used wherever elapsed time is compared against a grace/repeat
 * number (those numbers count working days — critique #281, step 3).
 */
export function workingDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let count = 0;
  let cursor = new Date(from);
  let guard = 0;
  // Walk forward a day at a time; count each working London-day we land on,
  // stopping once we pass `to`.
  while (guard < 3660) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard++;
    if (londonDateKey(cursor) > londonDateKey(to)) break;
    if (isWorkingDay(cursor)) count++;
  }
  return count;
}

/**
 * Rolls a date FORWARD to the next working day (weekends + E&W bank holidays),
 * preserving the time of day. Already-working days pass through unchanged.
 * The reminder engine wraps every stored due/wake date in this (critique #281,
 * business-days step 2) so nothing lands due on a weekend; the actual sends
 * are separately gated by the Mon-Fri cron schedules. Bounded like the other
 * walkers so a malformed holiday table can't loop.
 */
export function rollToWorkingDay(d: Date): Date {
  let cursor = new Date(d);
  for (let i = 0; i < 20 && !isWorkingDay(cursor); i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return cursor;
}

/**
 * Rolls a date forward past bank holidays and closure windows ONLY — weekends
 * are deliberately left intact, preserving the time of day. For the 24/7
 * transactional sends (milestone confirmations) that SHOULD still reach a client
 * on a weekend (they react to the client's own action) but must not land on a
 * bank holiday or over the Christmas close-down. Rolling the stored send date
 * (rather than gating the drain) keeps the queue's retry age-out clock correct.
 */
export function rollPastHolidayOrClosure(d: Date): Date {
  let cursor = new Date(d);
  for (let i = 0; i < 20 && isHolidayOrClosureKey(londonDateKey(cursor)); i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return cursor;
}

/**
 * Returns the deliver-at instant for a transactional client send.
 *   - Inside working hours (Mon–Fri 09:00–17:00 London, non-bank-holiday)
 *     → returns `now` unchanged. Drain runs hourly and will pick it up
 *     on the next tick.
 *   - Outside the window → returns the next working day at 09:00 London
 *     as a UTC Date.
 *
 * Note: callers that enqueue this date via OutboundEmailQueue rely on
 * /api/cron/drain-outbound-email (hourly Mon–Sat) to pick it up.
 * Sundays are excluded by the cron schedule itself, and bank-holiday
 * Mondays are excluded by this helper deferring them to Tuesday —
 * so a row scheduled by this helper will never be delivered on a
 * non-working day, even with the broader Mon–Sat drain window.
 */
export function deliverAtInsideWorkingWindow(now: Date = new Date()): Date {
  if (isWorkingDay(now)) {
    const { hour } = londonParts(now);
    if (hour >= WORKING_HOURS_OPEN && hour < WORKING_HOURS_CLOSE) {
      return now;
    }
    // Before 09:00 on a working day → schedule for 09:00 today.
    if (hour < WORKING_HOURS_OPEN) {
      const { year, month, day } = londonParts(now);
      return londonHourAsUTC(year, month, day, WORKING_HOURS_OPEN);
    }
    // After close → roll to next working day.
  }
  return nextWorkingDayAt9am(now);
}

// Re-export for tests / preview surfaces that need to render the same
// rules visibly. Not part of the public scheduling contract.
export const __test__ = {
  isWorkingDay,
  londonDateKey,
  nextWorkingDayAt9am,
  BANK_HOLIDAYS: BANK_HOLIDAYS_ENG_WALES,
};
