/**
 * @jest-environment node
 *
 * TIMING BASELINE — the OTHER business-day calendar (Step 1 of the
 * business-days work, critique #281). lib/services/fees.ts carries its own
 * weekend/bank-holiday helpers used by the exchange prediction ("exchange
 * never lands on a weekend") and the founder cockpit. It duplicates the
 * holiday table in lib/emails/working-hours.ts — pinned here so a future
 * consolidation can prove it changed nothing.
 *
 * NOTE: unlike working-hours.ts (London-calendar via Intl), these helpers are
 * LOCAL-date based. Tests therefore construct dates with the local-time
 * constructor so they hold on any machine.
 */

import { rollToBusinessDay, businessDaysSince } from "@/lib/services/fees";

// Local-midnight constructor: new Date(y, mIndex, d) is the same local
// calendar day in every timezone.
const local = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("rollToBusinessDay", () => {
  it("a weekday stays put", () => {
    expect(ymd(rollToBusinessDay(local(2026, 10, 21)))).toBe("2026-10-21"); // Wednesday
  });
  it("Saturday rolls to Monday", () => {
    expect(ymd(rollToBusinessDay(local(2026, 10, 24)))).toBe("2026-10-26");
  });
  it("Sunday rolls to Monday", () => {
    expect(ymd(rollToBusinessDay(local(2026, 10, 25)))).toBe("2026-10-26");
  });
  it("a predicted date rolls past the whole Christmas close-down (2026 → 4 Jan)", () => {
    // The close-down (23 Dec–3 Jan) now counts as non-working for a date shown
    // to a client, so a prediction anywhere in the cluster rolls to the first
    // working day back, Mon 4 Jan. (Before the shutdown rule this stopped at the
    // 29th; a completion there is impossible, hence the change.)
    expect(ymd(rollToBusinessDay(local(2026, 12, 25)))).toBe("2027-01-04");
    expect(ymd(rollToBusinessDay(local(2026, 12, 26)))).toBe("2027-01-04");
  });
  it("substitute-day holidays are respected (3 Jan 2028 New Year sub → 4 Jan)", () => {
    expect(ymd(rollToBusinessDay(local(2028, 1, 1)))).toBe("2028-01-04"); // Sat 1st → Sun → BH Mon 3rd → Tue 4th
  });
});

describe("businessDaysSince", () => {
  it("same day = 0", () => {
    expect(businessDaysSince(local(2026, 10, 21), local(2026, 10, 21))).toBe(0);
  });
  it("Friday → Monday = 1 working day", () => {
    expect(businessDaysSince(local(2026, 10, 23), local(2026, 10, 26))).toBe(1);
  });
  it("a full week = 5 working days", () => {
    expect(businessDaysSince(local(2026, 10, 19), local(2026, 10, 26))).toBe(5);
  });
  it("the Christmas cluster counts only real working days", () => {
    // (24 Dec, 29 Dec]: 25 BH, 26 Sat, 27 Sun, 28 BH, 29 working → 1.
    expect(businessDaysSince(local(2026, 12, 24), local(2026, 12, 29))).toBe(1);
  });
});
