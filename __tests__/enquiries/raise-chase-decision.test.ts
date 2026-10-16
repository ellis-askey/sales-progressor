// The "get enquiries raised" timing brain. Covers the founder-approved schedule
// (buyer WD7, buyer's solicitor WD10, escalate WD13, then repeat every 6 WD) and
// the 2026-10-16 rule: automated nudging STOPS at escalation.

import { raiseChaseDecision, type RaiseChaseState } from "@/lib/enquiries/raise-chase-decision";
import { addWorkingDays } from "@/lib/emails/working-hours";

const OPENED = new Date("2026-09-15T09:00:00Z"); // searches ordered — the clock anchor

function state(partial: Partial<RaiseChaseState>): RaiseChaseState {
  return { openedAt: OPENED, lastNudgedAt: null, lastTarget: null, nudgeCount: 0, escalatedAt: null, expectedDate: null, ...partial };
}

describe("raiseChaseDecision", () => {
  it("does nothing before the first buyer nudge (WD7)", () => {
    const d = raiseChaseDecision(state({}), addWorkingDays(OPENED, 6));
    expect(d.nudgeDue).toBe(false);
    expect(d.escalateDue).toBe(false);
  });

  it("nudges the buyer at WD7", () => {
    const d = raiseChaseDecision(state({}), addWorkingDays(OPENED, 7));
    expect(d).toEqual({ nudgeDue: true, target: "buyer", escalateDue: false });
  });

  it("nudges the buyer's solicitor at WD10", () => {
    const s = state({ nudgeCount: 1, lastTarget: "buyer", lastNudgedAt: addWorkingDays(OPENED, 7) });
    const d = raiseChaseDecision(s, addWorkingDays(OPENED, 10));
    expect(d.nudgeDue).toBe(true);
    expect(d.target).toBe("buyer_solicitor");
    expect(d.escalateDue).toBe(false);
  });

  it("escalates at WD13 and does NOT also nudge, even when a nudge would otherwise be due", () => {
    // nudgeCount >= 2 repeats every 6 WD from the last nudge; last at WD7 → due again WD13.
    const s = state({ nudgeCount: 2, lastTarget: "buyer", lastNudgedAt: addWorkingDays(OPENED, 7) });
    const d = raiseChaseDecision(s, addWorkingDays(OPENED, 13));
    expect(d.escalateDue).toBe(true);
    expect(d.nudgeDue).toBe(false); // the fix: escalation supersedes the nudge on this run
    expect(d.target).toBeNull();
  });

  it("stops nudging entirely once escalated", () => {
    const s = state({
      nudgeCount: 2, lastTarget: "buyer_solicitor",
      lastNudgedAt: addWorkingDays(OPENED, 10),
      escalatedAt: addWorkingDays(OPENED, 13),
    });
    const d = raiseChaseDecision(s, addWorkingDays(OPENED, 40)); // long after; a nudge would otherwise be due
    expect(d.nudgeDue).toBe(false);
    expect(d.escalateDue).toBe(false);
    expect(d.target).toBeNull();
  });

  it("holds everything while a promised raised-by date is still in the future", () => {
    const s = state({ nudgeCount: 1, expectedDate: addWorkingDays(OPENED, 60) });
    const d = raiseChaseDecision(s, addWorkingDays(OPENED, 20));
    expect(d).toEqual({ nudgeDue: false, target: null, escalateDue: false });
  });
});
