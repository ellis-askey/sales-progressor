// Recurrence engine for Boardwalk To Do. Pure calendar-date arithmetic on
// "YYYY-MM-DD" strings — no Date-with-timezone maths, so UK daylight-saving
// transitions can never shift an occurrence's day, and completing a task
// always yields exactly one next occurrence (strictly after the reference
// date).

import type { RecurrenceRule } from "./types";

// ─── Date-string helpers (all take/return "YYYY-MM-DD") ─────────────────────

export function toParts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function fromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = toParts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fromParts(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addMonthsClamped(date: string, n: number, targetDay?: number): string {
  const { y, m, d } = toParts(date);
  const day = targetDay ?? d;
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fromParts(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

/** ISO weekday 1 (Mon) … 7 (Sun). */
export function isoWeekday(date: string): number {
  const { y, m, d } = toParts(date);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** First Mon–Fri day of the month containing `date`, offset by `monthsAhead`. */
export function firstWorkdayOfMonth(date: string, monthsAhead: number): string {
  const { y, m } = toParts(date);
  const total = y * 12 + (m - 1) + monthsAhead;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  let candidate = fromParts(ny, nm, 1);
  while (isoWeekday(candidate) > 5) candidate = addDays(candidate, 1);
  return candidate;
}

// ─── Next occurrence ─────────────────────────────────────────────────────────

/**
 * The next occurrence STRICTLY AFTER `after`, anchored at `anchor` (the
 * task's current due date; used for interval phase on weekly/monthly rules).
 * Deterministic and loop-bounded — a malformed rule can't hang the server.
 */
export function nextOccurrence(rule: RecurrenceRule, after: string, anchor?: string): string {
  const interval = Math.max(1, Math.min(rule.interval || 1, 365));
  const base = anchor && compareDates(anchor, after) > 0 ? addDays(after, 0) : after;

  switch (rule.freq) {
    case "daily":
      return addDays(after, interval);

    case "weekdays": {
      let next = addDays(after, 1);
      while (isoWeekday(next) > 5) next = addDays(next, 1);
      return next;
    }

    case "weekly": {
      const weekdays = (rule.weekdays?.length ? rule.weekdays : [isoWeekday(anchor ?? after)])
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b);
      if (interval === 1) {
        // Scan forward day-by-day (max 8 days) for the next listed weekday.
        for (let i = 1; i <= 8; i++) {
          const candidate = addDays(after, i);
          if (weekdays.includes(isoWeekday(candidate))) return candidate;
        }
        return addDays(after, 7);
      }
      // interval > 1: stay in the anchor's week-grid. Jump a week at a time
      // (bounded) until we land in an "on" week strictly after `after`.
      const anchorDate = anchor ?? after;
      let weekStart = addDays(anchorDate, 1 - isoWeekday(anchorDate)); // Monday of anchor week
      for (let hops = 0; hops < 120; hops++) {
        for (const wd of weekdays) {
          const candidate = addDays(weekStart, wd - 1);
          if (compareDates(candidate, after) > 0) return candidate;
        }
        weekStart = addDays(weekStart, 7 * interval);
      }
      return addDays(after, 7 * interval);
    }

    case "monthly": {
      const day = rule.monthDay ?? toParts(anchor ?? after).d;
      for (let k = 0; k <= 36; k += interval) {
        const candidate = addMonthsClamped(base, k, day);
        if (compareDates(candidate, after) > 0) return candidate;
      }
      return addMonthsClamped(after, interval, day);
    }

    case "monthly_first_workday": {
      for (let k = 0; k <= 36; k += interval) {
        const candidate = firstWorkdayOfMonth(base, k);
        if (compareDates(candidate, after) > 0) return candidate;
      }
      return firstWorkdayOfMonth(after, interval);
    }

    case "yearly": {
      const parts = toParts(anchor ?? after);
      const month = rule.month ?? parts.m;
      const day = rule.monthDay ?? parts.d;
      const { y } = toParts(after);
      for (let k = 0; k <= 8; k += 1) {
        const yy = y + k * Math.max(1, interval);
        const candidate = fromParts(yy, month, Math.min(day, daysInMonth(yy, month)));
        if (compareDates(candidate, after) > 0) return candidate;
      }
      return fromParts(y + interval, month, day);
    }

    default:
      return addDays(after, 1);
  }
}

// ─── Europe/London wall time → UTC instant ──────────────────────────────────
// Used when scheduling reminders: "2026-06-01 09:00" London is 08:00 UTC in
// summer, 09:00 UTC in winter. Resolved with Intl so DST is always right.

const LONDON_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function londonOffsetMinutes(utcGuess: Date): number {
  const parts = LONDON_FMT.formatToParts(utcGuess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((asIfUtc - utcGuess.getTime()) / 60000);
}

/** Converts a London wall-clock date+time to the real UTC instant. */
export function londonWallTimeToUtc(date: string, time: string): Date {
  const { y, m, d } = toParts(date);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = londonOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000);
}

/** Today's calendar date in London, "YYYY-MM-DD". */
export function todayInLondon(now = new Date()): string {
  const parts = LONDON_FMT.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Human description of a rule for pickers and chips. */
export function describeRule(rule: RecurrenceRule): string {
  return rule.label;
}
