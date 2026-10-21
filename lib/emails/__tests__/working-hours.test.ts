/**
 * @jest-environment node
 *
 * TIMING BASELINE — the working-day calendar (Step 1 of the business-days
 * work, critique #281). lib/emails/working-hours.ts is the canonical
 * weekend + England & Wales bank-holiday calendar: the solicitor-chase lane
 * already runs on it in production, and Step 2 routes the reminder and
 * client-chase lanes through the same machinery. These tests pin it down
 * before it takes on that extra weight.
 *
 * Fixed anchors (2026): 23 Dec = Wednesday, 24 Dec = Thursday,
 * 25 Dec = Christmas (Fri, bank holiday), 26/27 = weekend,
 * 28 Dec = substitute Boxing Day (Mon, bank holiday), 29 Dec = Tuesday.
 * December is GMT (London = UTC+0).
 */

import { addWorkingDays, deliverAtInsideWorkingWindow, rollToWorkingDay, __test__ } from "@/lib/emails/working-hours";

const { isWorkingDay, nextWorkingDayAt9am, BANK_HOLIDAYS } = __test__;
const iso = (d: Date) => d.toISOString();

describe("isWorkingDay (London weekday, not a bank holiday)", () => {
  it("weekdays are working days", () => {
    expect(isWorkingDay(new Date("2026-10-21T12:00:00.000Z"))).toBe(true); // Wednesday
  });
  it("weekends are not", () => {
    expect(isWorkingDay(new Date("2026-10-24T12:00:00.000Z"))).toBe(false); // Saturday
    expect(isWorkingDay(new Date("2026-10-25T12:00:00.000Z"))).toBe(false); // Sunday
  });
  it("E&W bank holidays are not", () => {
    expect(isWorkingDay(new Date("2026-12-25T12:00:00.000Z"))).toBe(false); // Christmas Day
    expect(isWorkingDay(new Date("2026-12-28T12:00:00.000Z"))).toBe(false); // substitute Boxing Day
    expect(isWorkingDay(new Date("2026-12-29T12:00:00.000Z"))).toBe(true);  // first day back
  });
  it("judges the LONDON calendar day, not the UTC one", () => {
    // 23:30 UTC on Friday 23 Oct is 00:30 London on SATURDAY the 24th (BST =
    // UTC+1) → not a working day, even though the UTC clock still says Friday.
    expect(isWorkingDay(new Date("2026-10-23T23:30:00.000Z"))).toBe(false);
  });
  it("the holiday table covers 2026-2028 (extend before 2028 runs out)", () => {
    expect(BANK_HOLIDAYS.has("2026-12-25")).toBe(true);
    expect(BANK_HOLIDAYS.has("2028-12-26")).toBe(true);
  });
});

describe("addWorkingDays", () => {
  it("N=0 returns the same instant", () => {
    expect(iso(addWorkingDays(new Date("2026-10-21T10:00:00.000Z"), 0))).toBe("2026-10-21T10:00:00.000Z");
  });
  it("skips a plain weekend", () => {
    // Friday 23 Oct + 1 working day = Monday 26 Oct (time-of-day preserved).
    expect(iso(addWorkingDays(new Date("2026-10-23T10:00:00.000Z"), 1))).toBe("2026-10-26T10:00:00.000Z");
  });
  it("skips the Christmas cluster (weekend + two bank holidays)", () => {
    // Wed 23 Dec + 2 working days: 24th counts (1), 25/26/27/28 skip, 29th counts (2).
    expect(iso(addWorkingDays(new Date("2026-12-23T10:00:00.000Z"), 2))).toBe("2026-12-29T10:00:00.000Z");
  });
});

describe("rollToWorkingDay (the step-2 weekend roll, critique #281)", () => {
  it("working days pass through unchanged, time preserved", () => {
    expect(iso(rollToWorkingDay(new Date("2026-10-21T10:30:00.000Z")))).toBe("2026-10-21T10:30:00.000Z"); // Wednesday
  });
  it("Saturday and Sunday roll to Monday, time preserved", () => {
    expect(iso(rollToWorkingDay(new Date("2026-10-24T00:00:00.000Z")))).toBe("2026-10-26T00:00:00.000Z");
    expect(iso(rollToWorkingDay(new Date("2026-10-25T10:00:00.000Z")))).toBe("2026-10-26T10:00:00.000Z");
  });
  it("rolls past the Christmas cluster to the 29th", () => {
    // 25 Dec (BH) → 26 Sat → 27 Sun → 28 (BH) → 29 Tue; a 26 Dec landing
    // rolls to the same place — rolling finds the NEXT working day, it
    // doesn't count days.
    expect(iso(rollToWorkingDay(new Date("2026-12-25T06:00:00.000Z")))).toBe("2026-12-29T06:00:00.000Z");
    expect(iso(rollToWorkingDay(new Date("2026-12-26T06:00:00.000Z")))).toBe("2026-12-29T06:00:00.000Z");
  });
});

describe("deliverAtInsideWorkingWindow (09:00-17:00 London, Mon-Fri, no holidays)", () => {
  it("inside the window → send now, unchanged", () => {
    const now = new Date("2026-12-02T11:00:00.000Z"); // Wed 11:00 GMT
    expect(deliverAtInsideWorkingWindow(now)).toBe(now);
  });
  it("before 09:00 on a working day → 09:00 London that day", () => {
    expect(iso(deliverAtInsideWorkingWindow(new Date("2026-12-02T07:30:00.000Z")))).toBe("2026-12-02T09:00:00.000Z");
  });
  it("after 17:00 → 09:00 the next working day", () => {
    // Friday 4 Dec 18:00 GMT → Monday 7 Dec 09:00.
    expect(iso(deliverAtInsideWorkingWindow(new Date("2026-12-04T18:00:00.000Z")))).toBe("2026-12-07T09:00:00.000Z");
  });
  it("a Saturday → Monday 09:00", () => {
    expect(iso(deliverAtInsideWorkingWindow(new Date("2026-12-05T11:00:00.000Z")))).toBe("2026-12-07T09:00:00.000Z");
  });
  it("Christmas Eve evening rolls all the way to the 29th", () => {
    expect(iso(deliverAtInsideWorkingWindow(new Date("2026-12-24T18:00:00.000Z")))).toBe("2026-12-29T09:00:00.000Z");
  });
  it("09:00 London is 08:00 UTC in summer (BST-aware)", () => {
    // Friday 26 Jun 2026 at 06:00 UTC (07:00 London, before open) → 09:00 London = 08:00 UTC.
    expect(iso(deliverAtInsideWorkingWindow(new Date("2026-06-26T06:00:00.000Z")))).toBe("2026-06-26T08:00:00.000Z");
  });
  it("nextWorkingDayAt9am always lands on a working morning", () => {
    const out = nextWorkingDayAt9am(new Date("2026-12-24T18:00:00.000Z"));
    expect(iso(out)).toBe("2026-12-29T09:00:00.000Z");
    expect(isWorkingDay(out)).toBe(true);
  });
});
