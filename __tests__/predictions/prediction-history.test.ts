/**
 * PR4 — Exchange prediction history (Data Optionality capture-now).
 *
 * The whole design is change-only, so the calendar-day change detector is the
 * load-bearing piece: it must fire on a genuine move (and on null↔date), and
 * NOT fire on a time-of-day-only difference (otherwise the per-confirm system
 * recompute would spam identical rows). Locked here.
 */

import {
  predictionChanged,
  recordPredictionChangeIfMoved,
} from "@/lib/services/exchange-prediction-history";

const d = (iso: string) => new Date(iso);

// Minimal fake Prisma handle capturing exchangePredictionHistory.create calls,
// so the change-only write can be asserted without a database.
function fakeDb() {
  const create = jest.fn().mockResolvedValue({});
  return { db: { exchangePredictionHistory: { create } } as never, create };
}

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

// The API-PATCH route (ExchangeTargetCell) lets an agent type an arbitrary
// expected-exchange date. That value has no derivable source, so it must be
// captured when it lands — but change-only, and attributed to the actor.
describe("recordPredictionChangeIfMoved via api_patch", () => {
  it("writes a change-only row for an arbitrary agent-entered date, preserving from -> to and actor", async () => {
    const { db, create } = fakeDb();
    const written = await recordPredictionChangeIfMoved(db, {
      transactionId: "tx1",
      field: "expectedExchangeDate",
      previousDate: d("2026-10-17T00:00:00Z"),
      predictedDate: d("2026-11-30T00:00:00Z"), // arbitrary agent-typed date
      source: "api_patch",
      isOverride: false,
      changedByUserId: "user-agent-1",
    });
    expect(written).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      transactionId: "tx1",
      field: "expectedExchangeDate",
      previousDate: d("2026-10-17T00:00:00Z"),
      predictedDate: d("2026-11-30T00:00:00Z"),
      source: "api_patch",
      isOverride: false,
      changedByUserId: "user-agent-1",
    });
  });

  it("does not write when the PATCH sets the same calendar day", async () => {
    const { db, create } = fakeDb();
    const written = await recordPredictionChangeIfMoved(db, {
      transactionId: "tx1",
      field: "expectedExchangeDate",
      previousDate: d("2026-10-17T00:00:00Z"),
      predictedDate: d("2026-10-17T09:15:00Z"), // same day, different time
      source: "api_patch",
      changedByUserId: "user-agent-1",
    });
    expect(written).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
