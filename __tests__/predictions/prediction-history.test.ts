/**
 * PR4 — Exchange prediction history (Data Optionality capture-now).
 *
 * The whole design is change-only, so the calendar-day change detector is the
 * load-bearing piece: it must fire on a genuine move (and on null↔date), and
 * NOT fire on a time-of-day-only difference (otherwise the per-confirm system
 * recompute would spam identical rows). Locked here.
 */

import { predictionChanged } from "@/lib/services/exchange-prediction-history";

const d = (iso: string) => new Date(iso);

describe("predictionChanged", () => {
  it("is false when both null", () => {
    expect(predictionChanged(null, null)).toBe(false);
  });

  it("is true on a first set (null -> date) and on a clear (date -> null)", () => {
    expect(predictionChanged(null, d("2026-10-17T00:00:00Z"))).toBe(true);
    expect(predictionChanged(d("2026-10-17T00:00:00Z"), null)).toBe(true);
  });

  it("is false when only the time-of-day differs (same calendar day, UTC)", () => {
    expect(
      predictionChanged(d("2026-10-17T00:00:00Z"), d("2026-10-17T14:32:09Z")),
    ).toBe(false);
  });

  it("is true when the calendar day moves", () => {
    expect(
      predictionChanged(d("2026-10-17T00:00:00Z"), d("2026-10-18T00:00:00Z")),
    ).toBe(true);
  });
});
