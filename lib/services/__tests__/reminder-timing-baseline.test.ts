/**
 * @jest-environment node
 *
 * TIMING BASELINE — characterisation tests for the reminder/chase engine's
 * date arithmetic (Step 1 of the business-days work, critique #281).
 *
 * These tests pin CURRENT behaviour, including behaviour we intend to change
 * (weekend landings, Saturday cron runs). Cases marked "CURRENT BEHAVIOUR —
 * changes in Step 2/3" are the deliberate change surface: when the
 * business-day work lands, those assertions get updated IN THE SAME COMMIT
 * as the behaviour change, with the new expected values. Everything else
 * must never change without a very good reason.
 *
 * All expectations are exact UTC instants so timezone/DST handling is pinned,
 * not approximated. Test inputs use fixed dates (2026) with known weekdays:
 *   2026-10-21 = Wednesday (BST: London = UTC+1 until 25 Oct 2026)
 *   2026-10-24 = Saturday
 *   2026-10-25 = Sunday (BST ends 02:00 — clocks go back)
 *   2026-12-02 = Wednesday (GMT: London = UTC+0)
 *   2026-03-29 = Sunday   (BST starts 01:00 — clocks go forward)
 */

import { setUkChaseTime, addDays as engineAddDays, EXPECTED_DATE_GRACE_DAYS } from "@/lib/services/reminders";
import { rollToWorkingDay, addWorkingDays } from "@/lib/emails/working-hours";
import {
  addDays as cronAddDays,
  daysBetween,
  dueReachedUk,
  CLIENT_CHASE_GRACE_FLOOR_DAYS,
  CLIENT_CHASE_COUNT_CAP,
} from "@/lib/services/client-chase-cron";
import { nextCronRun, CLIENT_CRON } from "@/lib/services/reminder-autopilot";

const iso = (d: Date) => d.toISOString();

// ─── setUkChaseTime — the 06:00-London normaliser ────────────────────────────

describe("setUkChaseTime (06:00 Europe/London, same UK calendar day)", () => {
  it("BST: an afternoon instant lands at 05:00 UTC (= 06:00 London)", () => {
    expect(iso(setUkChaseTime(new Date("2026-10-21T15:37:22.000Z")))).toBe("2026-10-21T05:00:00.000Z");
  });

  it("GMT: an afternoon instant lands at 06:00 UTC (= 06:00 London)", () => {
    expect(iso(setUkChaseTime(new Date("2026-12-02T15:00:00.000Z")))).toBe("2026-12-02T06:00:00.000Z");
  });

  it("is idempotent — re-normalising an already-normalised date is a no-op", () => {
    const once = setUkChaseTime(new Date("2026-10-21T15:37:22.000Z"));
    expect(iso(setUkChaseTime(once))).toBe(iso(once));
    const winter = setUkChaseTime(new Date("2026-12-02T15:00:00.000Z"));
    expect(iso(setUkChaseTime(winter))).toBe(iso(winter));
  });

  it("autumn clock-change day (BST ends 25 Oct 2026): normalises to 06:00 GMT", () => {
    // By 06:00 London on 25 Oct the clocks have already gone back → UTC+0.
    expect(iso(setUkChaseTime(new Date("2026-10-25T12:00:00.000Z")))).toBe("2026-10-25T06:00:00.000Z");
  });

  it("spring clock-change day (BST starts 29 Mar 2026): normalises to 06:00 BST", () => {
    // By 06:00 London on 29 Mar the clocks have already gone forward → UTC+1.
    expect(iso(setUkChaseTime(new Date("2026-03-29T12:00:00.000Z")))).toBe("2026-03-29T05:00:00.000Z");
  });

  it("an early-UTC instant still normalises to 06:00 on its UK calendar day", () => {
    // 00:30 UTC on 21 Oct = 01:30 London (BST) → UK day is the 21st.
    expect(iso(setUkChaseTime(new Date("2026-10-21T00:30:00.000Z")))).toBe("2026-10-21T05:00:00.000Z");
  });
});

// ─── The engine's grace-day arithmetic (first due date) ──────────────────────

describe("engine addDays + first-due composition", () => {
  it("adds calendar days and zeroes to UTC midnight", () => {
    expect(iso(engineAddDays(new Date("2026-10-21T10:00:00.000Z"), 3))).toBe("2026-10-24T00:00:00.000Z");
  });

  it("rolls over month ends", () => {
    expect(iso(engineAddDays(new Date("2026-10-30T10:00:00.000Z"), 3))).toBe("2026-11-02T00:00:00.000Z");
  });

  it("STEP 3 BEHAVIOUR: grace counts WORKING days — Wednesday + 3 is due MONDAY (Thu, Fri, Mon)", () => {
    // The engine's exact composition since step 3: addWorkingDays, then the
    // grace-0 safety roll, then 06:00 London. Crosses the BST→GMT clock change
    // (25 Oct), so the 06:00 London wake is 06:00 UTC, not 05:00 — pinned.
    const firstDue = setUkChaseTime(rollToWorkingDay(addWorkingDays(new Date("2026-10-21T10:00:00.000Z"), 3)));
    expect(iso(firstDue)).toBe("2026-10-26T06:00:00.000Z"); // Monday, 06:00 GMT
    expect(firstDue.getUTCDay()).toBe(1); // Monday
  });

  it("STEP 3 BEHAVIOUR: mid-week landings are unchanged by working-day counting", () => {
    // Wednesday 2 Dec + 2 working days = Friday 4 Dec.
    const firstDue = setUkChaseTime(rollToWorkingDay(addWorkingDays(new Date("2026-12-02T10:00:00.000Z"), 2)));
    expect(iso(firstDue)).toBe("2026-12-04T06:00:00.000Z"); // Friday, 06:00 GMT
  });

  it("STEP 3 BEHAVIOUR: grace 0 on a weekend anchor still rolls to Monday (the safety roll)", () => {
    // A milestone confirmed on Saturday 24 Oct with grace 0 — addWorkingDays
    // leaves it on Saturday, the roll pushes to Monday.
    const firstDue = setUkChaseTime(rollToWorkingDay(addWorkingDays(new Date("2026-10-24T10:00:00.000Z"), 0)));
    expect(iso(firstDue)).toBe("2026-10-26T06:00:00.000Z"); // Monday
  });

  it("expected-date anchored chases use zero grace (due the day itself)", () => {
    expect(EXPECTED_DATE_GRACE_DAYS).toBe(0);
    const due = setUkChaseTime(engineAddDays(new Date("2026-12-02T09:00:00.000Z"), EXPECTED_DATE_GRACE_DAYS));
    expect(iso(due)).toBe("2026-12-02T06:00:00.000Z");
  });

  it("repeat cadence composition: due date + repeat WORKING days, normalised to 06:00 London", () => {
    // Mirrors applyChaseToTask since step 3: addWorkingDays → roll → 06:00 UK.
    // Chase sent when due Wed 2 Dec, repeat 3 working days (Thu, Fri, Mon) →
    // MONDAY 7 Dec 06:00 GMT.
    const base = new Date("2026-12-02T06:00:00.000Z");
    const next = setUkChaseTime(rollToWorkingDay(addWorkingDays(base, 3)));
    expect(iso(next)).toBe("2026-12-07T06:00:00.000Z");
    expect(next.getUTCDay()).toBe(1); // Monday
  });
});

// ─── The client-chase cron's own date helpers ────────────────────────────────

describe("client-chase-cron date helpers", () => {
  it("cron addDays preserves time-of-day (unlike the engine's, which zeroes to UTC midnight)", () => {
    expect(iso(cronAddDays(new Date("2026-10-21T09:41:00.000Z"), 3))).toBe("2026-10-24T09:41:00.000Z");
  });

  it("daysBetween floors whole days", () => {
    expect(daysBetween(new Date("2026-10-24T10:00:00.000Z"), new Date("2026-10-21T09:00:00.000Z"))).toBe(3);
    expect(daysBetween(new Date("2026-10-24T08:00:00.000Z"), new Date("2026-10-21T09:00:00.000Z"))).toBe(2);
  });

  it("dueReachedUk compares UK calendar days, not instants", () => {
    // Due at 11:00 this morning, cron ticks at 09:30 — still "due today".
    expect(dueReachedUk(new Date("2026-10-21T09:30:00.000Z"), new Date("2026-10-21T11:00:00.000Z"))).toBe(true);
    // Not due until tomorrow (21:00 UTC = 22:00 London, still the 21st).
    expect(dueReachedUk(new Date("2026-10-21T21:00:00.000Z"), new Date("2026-10-22T05:00:00.000Z"))).toBe(false);
    // UK-day edge: 23:00 UTC on the 21st is already 00:00 London on the 22nd
    // (BST = UTC+1), so a chase due on the 22nd IS reached.
    expect(dueReachedUk(new Date("2026-10-21T23:00:00.000Z"), new Date("2026-10-22T05:00:00.000Z"))).toBe(true);
  });

  it("grace floor: client chases never fire sooner than 1 day after the anchor", () => {
    expect(CLIENT_CHASE_GRACE_FLOOR_DAYS).toBe(1);
    expect(Math.max(0, CLIENT_CHASE_GRACE_FLOOR_DAYS)).toBe(1);
  });

  it("autopilot hands over after 2 automated chases", () => {
    expect(CLIENT_CHASE_COUNT_CAP).toBe(2);
  });
});

// ─── nextCronRun — the "when will autopilot send this" prediction ────────────

describe("nextCronRun (autopilot send prediction)", () => {
  // Far-future due dates so the internal `new Date()` never wins the max().
  // Weekday anchors (verified in-test): 2030-10-04 = Friday, 2030-10-05 = Saturday.
  const SOLICITOR_CRON = { hour: 9, minute: 0, days: [1, 2, 3, 4, 5] };

  it("client cron runs Mon-Fri at 09:30 UTC (Mon-Sat until step 2)", () => {
    expect(CLIENT_CRON).toEqual({ hour: 9, minute: 30, days: [1, 2, 3, 4, 5] });
  });

  it("STEP 2 BEHAVIOUR: a chase due Friday evening is predicted to send MONDAY morning, never Saturday", () => {
    const friday = new Date("2030-10-04T18:00:00.000Z");
    expect(friday.getUTCDay()).toBe(5); // Friday
    const run = new Date(nextCronRun(friday, CLIENT_CRON));
    expect(iso(run)).toBe("2030-10-07T09:30:00.000Z");
    expect(run.getUTCDay()).toBe(1); // Monday
  });

  it("a chase due before the day's run time sends the same day", () => {
    const wed = new Date("2030-10-02T05:00:00.000Z");
    expect(wed.getUTCDay()).toBe(3); // Wednesday
    expect(nextCronRun(wed, CLIENT_CRON)).toBe("2030-10-02T09:30:00.000Z");
  });

  it("solicitor cron (Mon-Fri): a chase due Saturday is predicted for Monday", () => {
    const sat = new Date("2030-10-05T05:00:00.000Z");
    expect(sat.getUTCDay()).toBe(6); // Saturday
    const run = new Date(nextCronRun(sat, SOLICITOR_CRON));
    expect(iso(run)).toBe("2030-10-07T09:00:00.000Z");
    expect(run.getUTCDay()).toBe(1); // Monday
  });
});

// ─── Snooze wake maths (mirrors snoozeReminderLog's computation) ─────────────

describe("snooze wake computation (as composed in snoozeReminderLog)", () => {
  // snoozeReminderLog: base = picked date at noon UTC, OR now + hours; then
  // setUkChaseTime. These pin the two branches' semantics.

  // The quick-gap hour values map to working days in snoozeReminderLog:
  // 24→1, 48→2, 72→3, 168→5 (founder decision 2026-10-20). Replicated here.
  const quickDays = (hours: number) => (hours >= 168 ? 5 : Math.max(1, Math.round(hours / 24)));

  it("a picked date wakes at 06:00 London on that day (noon-UTC stamp defeats DST drift)", () => {
    const base = new Date("2026-10-23T12:00:00.000Z"); // picked "2026-10-23"
    expect(iso(setUkChaseTime(rollToWorkingDay(base)))).toBe("2026-10-23T05:00:00.000Z"); // Friday 06:00 BST
  });

  it("picking a Saturday wakes the following Monday at 06:00", () => {
    const base = new Date("2026-10-24T12:00:00.000Z"); // picked "2026-10-24", a Saturday
    const wake = setUkChaseTime(rollToWorkingDay(base));
    expect(iso(wake)).toBe("2026-10-26T06:00:00.000Z"); // Monday 06:00 GMT (post clock-change)
    expect(wake.getUTCDay()).toBe(1);
  });

  it("a Tomorrow snooze at Monday 13:00 UK wakes TUESDAY at 06:00 UK, not 13:00", () => {
    const snoozedAt = new Date("2026-12-07T13:00:00.000Z"); // Monday 13:00 GMT
    const wake = setUkChaseTime(rollToWorkingDay(addWorkingDays(snoozedAt, quickDays(24))));
    expect(iso(wake)).toBe("2026-12-08T06:00:00.000Z"); // Tuesday 06:00
  });

  it("STEP 3 BEHAVIOUR: In 2 days on a Thursday wakes MONDAY (working days, not calendar)", () => {
    const snoozedAt = new Date("2026-12-03T13:00:00.000Z"); // Thursday 13:00 GMT
    const wake = setUkChaseTime(rollToWorkingDay(addWorkingDays(snoozedAt, quickDays(48))));
    expect(iso(wake)).toBe("2026-12-07T06:00:00.000Z"); // Monday (Fri, Mon)
    expect(wake.getUTCDay()).toBe(1);
  });

  it("a Tomorrow snooze on Friday wakes MONDAY morning, never Saturday", () => {
    const snoozedAt = new Date("2026-12-04T13:00:00.000Z"); // Friday 13:00 GMT
    const wake = setUkChaseTime(rollToWorkingDay(addWorkingDays(snoozedAt, quickDays(24))));
    expect(iso(wake)).toBe("2026-12-07T06:00:00.000Z");
    expect(wake.getUTCDay()).toBe(1); // Monday
  });

  it("STEP 3 BEHAVIOUR: Next week (168h) means 5 working days — Monday wakes the following Monday", () => {
    const snoozedAt = new Date("2026-12-07T13:00:00.000Z"); // Monday 13:00 GMT
    const wake = setUkChaseTime(rollToWorkingDay(addWorkingDays(snoozedAt, quickDays(168))));
    expect(iso(wake)).toBe("2026-12-14T06:00:00.000Z"); // next Monday
    expect(wake.getUTCDay()).toBe(1);
  });
});
