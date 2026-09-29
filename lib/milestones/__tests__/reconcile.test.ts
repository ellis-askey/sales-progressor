// Unit tests for the milestone unlock self-heal decision.
// See docs/active/milestone-unlock-selfheal.

import { computeReconcileUnlocks, RECONCILE_EXCLUDE } from "../reconcile";

const m = (obj: Record<string, string>): Map<string, string> => new Map(Object.entries(obj));

describe("computeReconcileUnlocks", () => {
  it("unlocks a step whose prerequisites are all complete (out-of-order confirmation)", () => {
    // PM8 (searches) needs PM7 (pack) + PM4 (money on account); both done, PM8 stuck.
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM4: "complete", PM8: "locked" }))).toEqual(["PM8"]);
  });

  it("unlocks a step waiting only on the pack (PM14 <- PM7)", () => {
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM14: "locked" }))).toEqual(["PM14"]);
  });

  it("treats a not_required prerequisite as satisfied", () => {
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM4: "not_required", PM8: "locked" }))).toEqual(["PM8"]);
  });

  it("does NOT unlock when a prerequisite is still incomplete", () => {
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM4: "available", PM8: "locked" }))).toEqual([]);
  });

  it("does NOT unlock when a prerequisite is missing from scope entirely", () => {
    // PM4 unknown → cannot be confirmed satisfied → stay locked.
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM8: "locked" }))).toEqual([]);
  });

  it("ignores steps that aren't locked", () => {
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM4: "complete", PM8: "complete" }))).toEqual([]);
    expect(computeReconcileUnlocks(m({ PM7: "complete", PM4: "complete", PM8: "available" }))).toEqual([]);
  });

  it("never auto-flips the excluded gate / bilateral codes", () => {
    expect(computeReconcileUnlocks(m({ VM18: "complete", VM19: "locked", PM25: "locked", PM26: "locked" }))).toEqual([]);
    for (const c of ["VM18", "PM25", "VM19", "PM26", "VM20", "PM27"]) {
      expect(RECONCILE_EXCLUDE.has(c)).toBe(true);
    }
  });

  it("does not unlock a step that has no prerequisites", () => {
    // PM7 (pack received) carries no prerequisites; a stray locked row is left alone.
    expect(computeReconcileUnlocks(m({ PM7: "locked" }))).toEqual([]);
  });

  it("unlocks multiple stranded steps in one pass", () => {
    const out = computeReconcileUnlocks(m({ PM7: "complete", PM4: "complete", PM8: "locked", PM14: "locked" }));
    expect(out.sort()).toEqual(["PM14", "PM8"]);
  });
});
