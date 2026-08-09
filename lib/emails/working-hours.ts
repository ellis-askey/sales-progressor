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
// Bank holidays are maintained as a static list of YYYY-MM-DD strings.
// The list MUST be kept current; mid-year, the gov.uk feed at
// https://www.gov.uk/bank-holidays.json is authoritative. We do not pull
// the feed at runtime — that adds an outbound dependency to the scheduling
// path and a stale-cache failure mode that's hard to detect. Annual manual
// refresh is cheap and explicit.

// England & Wales bank holidays — current + next two years.
// Source: https://www.gov.uk/bank-holidays.json (england-and-wales division).
// Add new years as they're announced; remove past years opportunistically.
const BANK_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-04-03", // Good Friday
  "2026-04-06", // Easter Monday
  "2026-05-04", // Early May bank holiday
  "2026-05-25", // Spring bank holiday
  "2026-08-31", // Summer bank holiday
  "2026-12-25", // Christmas Day
  "2026-12-28", // Boxing Day (substitute — 26th is a Saturday)
  // 2027
  "2027-01-01", // New Year's Day
  "2027-03-26", // Good Friday
  "2027-03-29", // Easter Monday
  "2027-05-03", // Early May bank holiday
  "2027-05-31", // Spring bank holiday
  "2027-08-30", // Summer bank holiday
  "2027-12-27", // Christmas Day (substitute — 25th is a Saturday)
  "2027-12-28", // Boxing Day (substitute — 26th is a Sunday)
  // 2028
  "2028-01-03", // New Year's Day (substitute — 1st is a Saturday)
  "2028-04-14", // Good Friday
  "2028-04-17", // Easter Monday
  "2028-05-01", // Early May bank holiday
  "2028-05-29", // Spring bank holiday
  "2028-08-28", // Summer bank holiday
  "2028-12-25", // Christmas Day
  "2028-12-26", // Boxing Day
]);

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

// A "working day" = Monday–Friday AND not on the bank-holiday list.
function isWorkingDay(d: Date): boolean {
  const { weekday } = londonParts(d);
  if (weekday === 0 || weekday === 6) return false; // Sun/Sat
  if (BANK_HOLIDAYS.has(londonDateKey(d))) return false;
  return true;
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
  for (let i = 0; i < 14; i++) {
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
  BANK_HOLIDAYS,
};
