/**
 * @jest-environment node
 */

// londonDayBounds powers the Completions nav badge (countCompletionsToday:
// active files with completionDate in [start, end)). Date-only completion dates
// are stored at midnight UTC, so the window's upper bound must be EXACTLY the
// next London midnight with no sub-second slop — otherwise tomorrow's completion
// leaks into today's count. That slop bug showed up on 25 Oct 2026 (the GMT
// changeover) when the badge counted a file completing the 26th. These pin it.

import { londonDayBounds } from "@/lib/utils";

describe("londonDayBounds", () => {
  it("GMT (winter): a completion at tomorrow's midnight UTC is NOT inside today", () => {
    // 25 Oct 2026 10:11 UTC — GMT in force. 29 Berwick completed 26 Oct.
    const now = new Date("2026-10-25T10:11:42.539Z");
    const { start, end } = londonDayBounds(now);
    const tomorrowMidnightUtc = new Date("2026-10-26T00:00:00.000Z");
    expect(tomorrowMidnightUtc.getTime()).toBeGreaterThanOrEqual(end.getTime()); // excluded
    // Today's own completion (25 Oct midnight UTC) IS inside.
    const todayMidnightUtc = new Date("2026-10-25T00:00:00.000Z");
    expect(todayMidnightUtc.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(todayMidnightUtc.getTime()).toBeLessThan(end.getTime());
  });

  it("bounds land on exact second boundaries (no millisecond slop from `now`)", () => {
    const { start, end } = londonDayBounds(new Date("2026-11-15T13:47:21.823Z"));
    expect(start.getTime() % 1000).toBe(0);
    expect(end.getTime() % 1000).toBe(0);
  });

  it("BST (summer): midnight London is 23:00 UTC the previous day", () => {
    // 15 Jul 2026 — BST (+1).
    const { start, end } = londonDayBounds(new Date("2026-07-15T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-14T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-15T23:00:00.000Z");
    // A 16 Jul completion (stored 16 Jul 00:00 UTC) is NOT in the 15 Jul window.
    expect(new Date("2026-07-16T00:00:00.000Z").getTime()).toBeGreaterThanOrEqual(end.getTime());
  });

  it("deep winter: the window is exactly the UTC calendar day", () => {
    const { start, end } = londonDayBounds(new Date("2027-01-20T09:00:00Z"));
    expect(start.toISOString()).toBe("2027-01-20T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-21T00:00:00.000Z");
  });
});
