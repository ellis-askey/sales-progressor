/**
 * @jest-environment node
 *
 * The one-time calendar→working-day value conversion (critique #281, step 3).
 * This exact function is what the conversion script runs against the live
 * rules, overrides and per-file snapshots, so the founder-approved table is
 * pinned value by value.
 */

import { calendarToWorkingDays } from "@/lib/reminders/working-day-conversion";

describe("calendarToWorkingDays (founder-approved table, 2026-10-20)", () => {
  it("0-3 are unchanged", () => {
    expect(calendarToWorkingDays(0)).toBe(0);
    expect(calendarToWorkingDays(1)).toBe(1);
    expect(calendarToWorkingDays(2)).toBe(2);
    expect(calendarToWorkingDays(3)).toBe(3);
  });

  it("the approved table: 5→4, 7→5, 10→7, 12→9, 14→10, 21→15, 28→20", () => {
    expect(calendarToWorkingDays(5)).toBe(4);
    expect(calendarToWorkingDays(7)).toBe(5);
    expect(calendarToWorkingDays(10)).toBe(7);
    expect(calendarToWorkingDays(12)).toBe(9);
    expect(calendarToWorkingDays(14)).toBe(10);
    expect(calendarToWorkingDays(21)).toBe(15);
    expect(calendarToWorkingDays(28)).toBe(20);
  });

  it("in-between values scale by 5/7, rounded to the nearest day", () => {
    expect(calendarToWorkingDays(4)).toBe(3);
    expect(calendarToWorkingDays(6)).toBe(4);
    expect(calendarToWorkingDays(30)).toBe(21);
  });

  it("garbage in, garbage untouched (negative / non-finite values pass through)", () => {
    expect(calendarToWorkingDays(-1)).toBe(-1);
    expect(calendarToWorkingDays(Number.NaN)).toBeNaN();
  });
});
