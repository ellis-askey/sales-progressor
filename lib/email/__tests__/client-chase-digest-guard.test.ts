/**
 * @jest-environment node
 */

// Regression tests for the multi-contact chase-inflation guard
// (chaseAlreadyAppliedToday), added 2026-08-17 after Walnut Tree Barn showed
// "Chased 6x" from 2 real rounds x 3 seller contacts.
//
// enqueueClientChaseDigest runs once per contact and, at its tail, calls
// applyChaseToTask for every pending task on the file. The guard caps that to
// one apply per task per UK day so N recipients no longer multiply the count.
// These are pure-function tests (the codebase convention for this layer): they
// simulate the per-contact loop threading lastChasedAt the way
// applyChaseToTask stamps it, and assert the apply fires exactly once.

import { chaseAlreadyAppliedToday } from "@/lib/email/client-chase-digest";

// Model of the digest tail: for one shared task, run the guard once per
// contact. When it says "not yet chased today", we apply (count++) and stamp
// lastChasedAt = now, exactly as applyChaseToTask does.
function simulateRound(contactCount: number, now: Date, startLastChasedAt: Date | null) {
  let lastChasedAt = startLastChasedAt;
  let applyCount = 0;
  for (let c = 0; c < contactCount; c++) {
    if (!chaseAlreadyAppliedToday(lastChasedAt, now)) {
      applyCount++;
      lastChasedAt = now; // applyChaseToTask bumps chaseCount + advances nextDue once
    }
  }
  return { applyCount, lastChasedAt };
}

describe("chaseAlreadyAppliedToday - multi-contact inflation guard", () => {
  it("applies once for one task across 3 contacts in a single round", () => {
    const now = new Date("2026-08-17T08:10:00Z");
    const { applyCount } = simulateRound(3, now, null);
    // 3 seller contacts, 1 task -> chaseCount +1 and nextDue advanced once.
    expect(applyCount).toBe(1);
  });

  it("re-applies on a later UK day (a genuine second round)", () => {
    const round1 = new Date("2026-08-17T08:10:00Z");
    const round2 = new Date("2026-08-24T08:10:00Z");
    const a = simulateRound(3, round1, null);
    const b = simulateRound(3, round2, a.lastChasedAt);
    // Two real rounds a week apart -> exactly two applies total.
    expect(a.applyCount + b.applyCount).toBe(2);
  });

  it("treats a never-chased task (null lastChasedAt) as eligible", () => {
    expect(chaseAlreadyAppliedToday(null, new Date("2026-08-17T08:10:00Z"))).toBe(false);
  });

  it("counts different UTC instants on the same UK day as already chased", () => {
    // In BST the UK day 2026-08-17 runs 2026-08-16T23:00Z .. 2026-08-17T22:59Z,
    // so a 07:00Z morning chase and a 21:00Z evening pass are the same UK day.
    const morning = new Date("2026-08-17T07:00:00Z");
    const evening = new Date("2026-08-17T21:00:00Z");
    expect(chaseAlreadyAppliedToday(morning, evening)).toBe(true);
  });

  it("does not suppress across a UK midnight boundary", () => {
    // Chased late on the 17th (UK), evaluated early on the 18th (UK) -> eligible.
    const lateOn17 = new Date("2026-08-17T21:00:00Z"); // 22:00 UK
    const earlyOn18 = new Date("2026-08-18T06:00:00Z"); // 07:00 UK next day
    expect(chaseAlreadyAppliedToday(lateOn17, earlyOn18)).toBe(false);
  });
});
