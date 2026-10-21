/**
 * @jest-environment node
 *
 * TIMING BASELINE — the bucket rules (Step 1 of the business-days work,
 * critique #281). classifyReminder is the single source of truth for whether
 * a reminder reads as overdue / due today / upcoming / snoozed, so the whole
 * work queue hangs off these semantics. Pure characterisation: pins current
 * behaviour, including weekend due dates counting like any other day.
 *
 * Fixed-weekday anchors (2026): 21 Oct = Wednesday, 24 Oct = Saturday.
 * October 2026 is BST (London = UTC+1).
 */

import { classifyReminder, isActionable, countActionable, countOverdue, type LogForClassify } from "@/lib/reminders/classify";

const log = (over: Partial<LogForClassify>): LogForClassify => ({
  nextDueDate: new Date("2026-10-21T05:00:00.000Z"),
  snoozedUntil: null,
  status: "active",
  chaseTasks: [],
  ...over,
});

// "Now" = Wednesday 21 Oct 2026, 10:00 London.
const NOW = new Date("2026-10-21T09:00:00.000Z");

describe("classifyReminder buckets", () => {
  it("due earlier today → due_today (UK calendar-day comparison, not instants)", () => {
    expect(classifyReminder(log({ nextDueDate: new Date("2026-10-21T05:00:00.000Z") }), NOW)).toBe("due_today");
    // Due LATER today is still due_today — same UK day.
    expect(classifyReminder(log({ nextDueDate: new Date("2026-10-21T15:00:00.000Z") }), NOW)).toBe("due_today");
  });

  it("due yesterday → overdue", () => {
    expect(classifyReminder(log({ nextDueDate: new Date("2026-10-20T05:00:00.000Z") }), NOW)).toBe("overdue");
  });

  it("due tomorrow → upcoming", () => {
    expect(classifyReminder(log({ nextDueDate: new Date("2026-10-22T05:00:00.000Z") }), NOW)).toBe("upcoming");
  });

  it("CURRENT BEHAVIOUR — changes in Step 2/3: a reminder due on SATURDAY buckets like any other day", () => {
    // Saturday 24 Oct: upcoming on Wednesday…
    const satLog = log({ nextDueDate: new Date("2026-10-24T05:00:00.000Z") });
    expect(classifyReminder(satLog, NOW)).toBe("upcoming");
    // …and due_today when "now" is that Saturday — the engine has no concept
    // of a non-working day. Step 2 stops due dates LANDING on Saturdays; this
    // bucket logic itself stays date-based.
    expect(classifyReminder(satLog, new Date("2026-10-24T09:00:00.000Z"))).toBe("due_today");
  });

  it("snooze hides a row until the exact wake instant, then it re-buckets by date", () => {
    const snoozed = log({ snoozedUntil: new Date("2026-10-22T05:00:00.000Z"), nextDueDate: new Date("2026-10-22T05:00:00.000Z") });
    expect(classifyReminder(snoozed, NOW)).toBe("snoozed"); // Wed: still asleep
    // One millisecond past the wake instant → no longer snoozed, buckets by day.
    expect(classifyReminder(snoozed, new Date("2026-10-22T05:00:00.001Z"))).toBe("due_today");
  });

  it("an escalated pending task wins over date bucketing", () => {
    const esc = log({ chaseTasks: [{ status: "pending", priority: "escalated", chaseCount: 2 }] });
    expect(classifyReminder(esc, NOW)).toBe("escalated");
    // …but only a PENDING task escalates; a cancelled one doesn't.
    const cancelled = log({ chaseTasks: [{ status: "cancelled", priority: "escalated", chaseCount: 2 }] });
    expect(classifyReminder(cancelled, NOW)).toBe("due_today");
  });

  it("non-active logs are inactive regardless of dates", () => {
    expect(classifyReminder(log({ status: "completed" }), NOW)).toBe("inactive");
    expect(classifyReminder(log({ status: "cancelled" }), NOW)).toBe("inactive");
  });
});

describe("actionability + counts", () => {
  it("overdue, due_today and escalated count; upcoming/snoozed/inactive don't", () => {
    expect(isActionable("overdue")).toBe(true);
    expect(isActionable("due_today")).toBe(true);
    expect(isActionable("escalated")).toBe(true);
    expect(isActionable("upcoming")).toBe(false);
    expect(isActionable("snoozed")).toBe(false);
    expect(isActionable("inactive")).toBe(false);
  });

  it("countActionable / countOverdue agree with the buckets", () => {
    const logs = [
      log({ nextDueDate: new Date("2026-10-20T05:00:00.000Z") }), // overdue
      log({ nextDueDate: new Date("2026-10-21T05:00:00.000Z") }), // due_today
      log({ nextDueDate: new Date("2026-10-23T05:00:00.000Z") }), // upcoming
      log({ status: "completed" }),                                // inactive
    ];
    expect(countActionable(logs, NOW)).toBe(2);
    expect(countOverdue(logs, NOW)).toBe(1);
  });
});
