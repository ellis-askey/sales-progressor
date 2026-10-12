// Boardwalk To Do — recurrence engine + natural-language parser. These are
// the pure cores everything else trusts: wrong recurrence silently corrupts
// schedules, wrong parsing mis-schedules captured tasks.

import { nextOccurrence, londonWallTimeToUtc, firstWorkdayOfMonth, addDays, isoWeekday } from "@/lib/todo/recurrence";
import { parseQuickAdd } from "@/lib/todo/nlp";
import type { RecurrenceRule } from "@/lib/todo/types";

const rule = (r: Partial<RecurrenceRule> & Pick<RecurrenceRule, "freq">): RecurrenceRule => ({
  interval: 1,
  label: "test",
  ...r,
});

describe("recurrence: nextOccurrence", () => {
  it("daily advances one day; every 3 days advances three", () => {
    expect(nextOccurrence(rule({ freq: "daily" }), "2026-10-12")).toBe("2026-10-13");
    expect(nextOccurrence(rule({ freq: "daily", interval: 3 }), "2026-10-12")).toBe("2026-10-15");
  });

  it("weekdays skips weekends", () => {
    // 2026-10-16 is a Friday
    expect(nextOccurrence(rule({ freq: "weekdays" }), "2026-10-16")).toBe("2026-10-19"); // Monday
  });

  it("weekly on monday finds the next monday strictly after", () => {
    // 2026-10-12 is a Monday
    expect(nextOccurrence(rule({ freq: "weekly", weekdays: [1] }), "2026-10-12")).toBe("2026-10-19");
  });

  it("weekly on mon+thu picks the nearest listed day", () => {
    const r = rule({ freq: "weekly", weekdays: [1, 4] });
    expect(nextOccurrence(r, "2026-10-12")).toBe("2026-10-15"); // Thu
    expect(nextOccurrence(r, "2026-10-15")).toBe("2026-10-19"); // Mon
  });

  it("every second friday stays on the anchor fortnight grid", () => {
    const r = rule({ freq: "weekly", interval: 2, weekdays: [5] });
    // anchor Friday 2026-10-16, completed on the day → next is 2 weeks later
    expect(nextOccurrence(r, "2026-10-16", "2026-10-16")).toBe("2026-10-30");
    // completed LATE (on the 20th) → still lands on the grid, not a drifted date
    expect(nextOccurrence(r, "2026-10-20", "2026-10-16")).toBe("2026-10-30");
  });

  it("monthly clamps the 31st to short months", () => {
    const r = rule({ freq: "monthly", monthDay: 31 });
    expect(nextOccurrence(r, "2026-01-31", "2026-01-31")).toBe("2026-02-28");
  });

  it("monthly every 3 months advances a quarter", () => {
    const r = rule({ freq: "monthly", interval: 3, monthDay: 15 });
    expect(nextOccurrence(r, "2026-10-15", "2026-10-15")).toBe("2027-01-15");
  });

  it("first working day of each month skips a weekend 1st", () => {
    // November 2026: the 1st is a Sunday → first workday is Mon the 2nd
    expect(firstWorkdayOfMonth("2026-10-12", 1)).toBe("2026-11-02");
    const r = rule({ freq: "monthly_first_workday" });
    expect(nextOccurrence(r, "2026-10-12", "2026-10-01")).toBe("2026-11-02");
  });

  it("yearly advances a year and respects month/day", () => {
    const r = rule({ freq: "yearly", month: 4, monthDay: 6 });
    expect(nextOccurrence(r, "2026-04-06", "2026-04-06")).toBe("2027-04-06");
  });

  it("never returns the reference date itself (no duplicate occurrences)", () => {
    for (const r of [
      rule({ freq: "daily" }),
      rule({ freq: "weekdays" }),
      rule({ freq: "weekly", weekdays: [1, 3, 5] }),
      rule({ freq: "monthly", monthDay: 12 }),
    ]) {
      const next = nextOccurrence(r, "2026-10-12", "2026-10-12");
      expect(next > "2026-10-12").toBe(true);
    }
  });
});

describe("recurrence: London wall time → UTC (DST)", () => {
  it("summer 09:00 London is 08:00 UTC", () => {
    expect(londonWallTimeToUtc("2026-06-01", "09:00").toISOString()).toBe("2026-06-01T08:00:00.000Z");
  });
  it("winter 09:00 London is 09:00 UTC", () => {
    expect(londonWallTimeToUtc("2026-12-01", "09:00").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});

describe("natural-language quick-add", () => {
  const today = "2026-10-12"; // a Monday

  it("call vendor tomorrow at 10am", () => {
    const p = parseQuickAdd("Call vendor tomorrow at 10am", today);
    expect(p.title).toBe("Call vendor");
    expect(p.dueDate).toBe("2026-10-13");
    expect(p.dueTime).toBe("10:00");
  });

  it("chase photographer friday", () => {
    const p = parseQuickAdd("Chase photographer friday", today);
    expect(p.title).toBe("Chase photographer");
    expect(p.dueDate).toBe("2026-10-16");
  });

  it("prepare valuation report every monday at 9am", () => {
    const p = parseQuickAdd("Prepare valuation report every Monday at 9am", today);
    expect(p.title).toBe("Prepare valuation report");
    expect(p.recurrence?.freq).toBe("weekly");
    expect(p.recurrence?.weekdays).toEqual([1]);
    expect(p.dueTime).toBe("09:00");
    expect(p.dueDate).toBe("2026-10-12"); // next monday on-or-after today
  });

  it("follow up with James next week #Valuations", () => {
    const p = parseQuickAdd("Follow up with James next week #Valuations", today);
    expect(p.title).toBe("Follow up with James");
    expect(p.dueDate).toBe("2026-10-19");
    expect(p.projectToken).toBe("Valuations");
  });

  it("every second friday + first working day of each month", () => {
    const a = parseQuickAdd("Invoice run every second friday", today);
    expect(a.recurrence?.freq).toBe("weekly");
    expect(a.recurrence?.interval).toBe(2);
    const b = parseQuickAdd("Invoice run first working day of each month", today);
    expect(b.recurrence?.freq).toBe("monthly_first_workday");
  });

  it("p2 @urgent +nick in 3 days", () => {
    const p = parseQuickAdd("Fix window card p2 @urgent +nick in 3 days", today);
    expect(p.title).toBe("Fix window card");
    expect(p.priority).toBe(2);
    expect(p.labelTokens).toEqual(["urgent"]);
    expect(p.assigneeToken).toBe("nick");
    expect(p.dueDate).toBe("2026-10-15");
  });

  it("explicit dates roll forward past dates to next year", () => {
    const p = parseQuickAdd("Renew contract 5 jan", today);
    expect(p.dueDate).toBe("2027-01-05");
  });

  it("uncertain text is preserved untouched", () => {
    const p = parseQuickAdd("Think about the maybe thing sometime", today);
    expect(p.title).toBe("Think about the maybe thing sometime");
    expect(p.dueDate).toBeNull();
    expect(p.recurrence).toBeNull();
  });

  it("a bare time implies today", () => {
    const p = parseQuickAdd("Team huddle at 4:30pm", today);
    expect(p.dueDate).toBe(today);
    expect(p.dueTime).toBe("16:30");
  });
});
