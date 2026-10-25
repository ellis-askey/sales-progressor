/**
 * @jest-environment node
 */

// Chase send-day helpers (2026-10-25). Chases run Mon–Fri only, so the
// Automated-emails page must not say "sending today" on a weekend — the backlog
// rolls to the next weekday. These pin the two helpers that drive that.

import { isLondonWeekday, nextChaseSendDay } from "../working-hours";

// Europe/London calendar date of a Date, for assertions.
const londonDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// Oct 2026: 23 Fri, 24 Sat, 25 Sun, 26 Mon, 28 Wed.
describe("isLondonWeekday", () => {
  it("is false on Saturday and Sunday", () => {
    expect(isLondonWeekday(new Date("2026-10-24T12:00:00Z"))).toBe(false);
    expect(isLondonWeekday(new Date("2026-10-25T12:00:00Z"))).toBe(false);
  });
  it("is true Monday–Friday", () => {
    expect(isLondonWeekday(new Date("2026-10-23T12:00:00Z"))).toBe(true); // Fri
    expect(isLondonWeekday(new Date("2026-10-26T12:00:00Z"))).toBe(true); // Mon
  });
});

describe("nextChaseSendDay", () => {
  it("rolls Saturday and Sunday forward to Monday", () => {
    expect(londonDay(nextChaseSendDay(new Date("2026-10-24T12:00:00Z")))).toBe("2026-10-26");
    expect(londonDay(nextChaseSendDay(new Date("2026-10-25T12:00:00Z")))).toBe("2026-10-26");
  });
  it("returns the same day on a weekday", () => {
    expect(londonDay(nextChaseSendDay(new Date("2026-10-28T12:00:00Z")))).toBe("2026-10-28"); // Wed
    expect(londonDay(nextChaseSendDay(new Date("2026-10-23T12:00:00Z")))).toBe("2026-10-23"); // Fri
  });
  it("a Friday-evening prediction for Saturday rolls to Monday", () => {
    // A chase predicted for Sat 24th goes out on Mon 26th.
    expect(londonDay(nextChaseSendDay(new Date("2026-10-24T08:30:00Z")))).toBe("2026-10-26");
  });
});
