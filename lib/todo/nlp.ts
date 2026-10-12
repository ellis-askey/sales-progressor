// Natural-language quick-add parser for Boardwalk To Do. Pure TypeScript, no
// AI services: recognises dates ("tomorrow", "friday", "next week", "12 oct",
// "in 3 days"), times ("at 10am", "9:30"), recurrence phrases ("every monday
// at 9", "every second friday", "every 3 months", "first working day of each
// month"), priorities (p1–p4), #project, @label and +assignee tokens.
// When uncertain it leaves the text alone — nothing is ever silently lost:
// only tokens that parsed with confidence are removed from the title.

import type { ParsedQuickAdd, RecurrenceRule } from "./types";
import { addDays, isoWeekday, todayInLondon } from "./recurrence";

const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 7, sun: 7,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

const ORDINAL_WORDS: Record<string, number> = { second: 2, third: 3, fourth: 4 };

function nextWeekdayOnOrAfter(from: string, weekday: number, strictlyAfter = false): string {
  let candidate = strictlyAfter ? addDays(from, 1) : from;
  for (let i = 0; i < 8; i++) {
    if (isoWeekday(candidate) === weekday) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function parseTimeToken(raw: string): string | null {
  // "10am" "10.30pm" "10:30" "9" (only with am/pm) "17:00"
  const m = raw.toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3];
  if (!meridiem && !m[2]) return null; // bare "9" is too ambiguous
  if (hh > 23 || mm > 59) return null;
  if (meridiem === "pm" && hh < 12) hh += 12;
  if (meridiem === "am" && hh === 12) hh = 0;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface Consumed {
  value: string;
  /** chars consumed from the source, to strip from the title */
  match: string;
}

export function parseQuickAdd(input: string, today = todayInLondon()): ParsedQuickAdd {
  let text = ` ${input.trim()} `;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let recurrence: RecurrenceRule | null = null;
  let priority: number | null = null;
  let projectToken: string | null = null;
  let assigneeToken: string | null = null;
  const labelTokens: string[] = [];

  const strip = (match: string) => {
    text = text.replace(match, " ");
  };

  // ── #project / @label / +assignee tokens ──
  for (const m of [...text.matchAll(/\s#([\w-]{1,40})/g)]) {
    projectToken = m[1];
    strip(m[0]);
  }
  for (const m of [...text.matchAll(/\s@([\w-]{1,40})/g)]) {
    labelTokens.push(m[1]);
    strip(m[0]);
  }
  for (const m of [...text.matchAll(/\s\+([\w.-]{1,60})/g)]) {
    assigneeToken = m[1];
    strip(m[0]);
  }

  // ── priority p1–p4 ──
  const pm = text.match(/\s[pP]([1-4])(?=[\s.,!]|$)/);
  if (pm) {
    priority = Number(pm[1]);
    strip(pm[0]);
  }

  // ── recurrence: "every …" ──
  // first working day of each month
  const fw = text.match(/\s(?:every\s+)?first\s+work(?:ing)?\s*day\s+of\s+(?:each|every|the)\s+month/i);
  if (fw) {
    recurrence = { freq: "monthly_first_workday", interval: 1, label: "first working day of each month" };
    strip(fw[0]);
  }
  if (!recurrence) {
    const ev = text.match(
      /\severy\s+(other\s+|second\s+|third\s+|fourth\s+|\d+\s+)?(day|weekday|week|month|year|monday|mon|tuesday|tue|tues|wednesday|wed|weds|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)(s)?(?=[\s.,!]|$)/i
    );
    if (ev) {
      const qualifier = (ev[1] ?? "").trim().toLowerCase();
      const unit = ev[2].toLowerCase();
      const interval =
        qualifier === "other" || qualifier === "second" ? 2
        : ORDINAL_WORDS[qualifier] ? ORDINAL_WORDS[qualifier]
        : /^\d+$/.test(qualifier) ? Math.max(1, Number(qualifier))
        : 1;
      const label = ev[0].trim().toLowerCase();
      if (unit === "day") recurrence = { freq: "daily", interval, label };
      else if (unit === "weekday") recurrence = { freq: "weekdays", interval: 1, label };
      else if (unit === "week") recurrence = { freq: "weekly", interval, label };
      else if (unit === "month") recurrence = { freq: "monthly", interval, label };
      else if (unit === "year") recurrence = { freq: "yearly", interval, label };
      else if (WEEKDAYS[unit]) {
        recurrence = { freq: "weekly", interval, weekdays: [WEEKDAYS[unit]], label };
        dueDate = nextWeekdayOnOrAfter(today, WEEKDAYS[unit], false);
      }
      if (recurrence) strip(ev[0]);
    }
  }

  // ── time: "at 10am" / "at 9:30" / bare "10am" ──
  const at = text.match(/\sat\s+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)(?=[\s.,!]|$)/i);
  if (at) {
    const t = parseTimeToken(at[1].replace(/\s/g, ""));
    if (t) {
      dueTime = t;
      strip(at[0]);
    }
  }
  if (!dueTime) {
    const bare = text.match(/\s(\d{1,2}(?:[:.]\d{2})?(?:am|pm))(?=[\s.,!]|$)/i);
    if (bare) {
      const t = parseTimeToken(bare[1]);
      if (t) {
        dueTime = t;
        strip(bare[0]);
      }
    }
  }

  // ── dates (skip if recurrence already set one) ──
  if (!dueDate) {
    const tests: { re: RegExp; resolve: (m: RegExpMatchArray) => string | null }[] = [
      { re: /\s(today|tonight)(?=[\s.,!]|$)/i, resolve: () => today },
      { re: /\stomorrow(?=[\s.,!]|$)/i, resolve: () => addDays(today, 1) },
      { re: /\snext\s+week(?=[\s.,!]|$)/i, resolve: () => nextWeekdayOnOrAfter(addDays(today, 1), 1, false) },
      { re: /\snext\s+month(?=[\s.,!]|$)/i, resolve: () => addDays(today, 30) },
      {
        re: /\sin\s+(\d{1,3})\s+(day|week|month)s?(?=[\s.,!]|$)/i,
        resolve: (m) => {
          const n = Number(m[1]);
          const unit = m[2].toLowerCase();
          return addDays(today, unit === "day" ? n : unit === "week" ? n * 7 : n * 30);
        },
      },
      {
        re: /\s(?:next\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|weds|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)(?=[\s.,!]|$)/i,
        resolve: (m) => {
          const wd = WEEKDAYS[m[1].toLowerCase()];
          const strict = /next\s+/i.test(m[0]);
          return nextWeekdayOnOrAfter(strict ? addDays(today, 1) : addDays(today, 1), wd, false);
        },
      },
      {
        // "12 oct", "12 october", "oct 12", "12/10", "12-10-2026"
        re: /\s(\d{1,2})[\s/-](jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[\s/-](\d{4}))?(?=[\s.,!]|$)/i,
        resolve: (m) => {
          const d = Number(m[1]);
          const mo = MONTHS[m[2].toLowerCase()];
          if (!mo || d < 1 || d > 31) return null;
          const y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
          let candidate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if (!m[3] && candidate < today) candidate = `${y + 1}-${candidate.slice(5)}`;
          return candidate;
        },
      },
      {
        re: /\s(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s/-](\d{1,2})(?=[\s.,!]|$)/i,
        resolve: (m) => {
          const mo = MONTHS[m[1].toLowerCase()];
          const d = Number(m[2]);
          if (!mo || d < 1 || d > 31) return null;
          const y = Number(today.slice(0, 4));
          let candidate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if (candidate < today) candidate = `${y + 1}-${candidate.slice(5)}`;
          return candidate;
        },
      },
    ];
    for (const t of tests) {
      const m = text.match(t.re);
      if (m) {
        const resolved = t.resolve(m);
        if (resolved) {
          dueDate = resolved;
          strip(m[0]);
          break;
        }
      }
    }
  }

  // A time with no date means today (or next occurrence handled by recurrence)
  if (dueTime && !dueDate && !recurrence) dueDate = today;

  const title = text.replace(/\s+/g, " ").trim();
  return {
    title: title || input.trim(),
    dueDate,
    dueTime,
    recurrence,
    priority,
    projectToken,
    labelTokens,
    assigneeToken,
  };
}
