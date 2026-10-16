/**
 * @jest-environment node
 *
 * Hand-over schedule vs manual chases (founder report, 2026-09-23): marking a
 * handed-over row as chased advanced the task's own due date, but the
 * compute-on-read schedule only looked at autopilot history and yanked the row
 * straight back into Needs you. A human chase must reset the clock.
 */

import { chaseHandoverDate, chaseHandoverPhase } from "../chase-escalation";

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("chaseHandoverDate with manual chases", () => {
  const now = new Date();

  it("capped autopilot chase with no manual chase hands over on schedule", () => {
    const d = chaseHandoverDate(
      { chaseCount: 2, firstChasedAt: days(-20), lastChasedAt: days(-10), lastEngagedAt: null },
      7,
      now,
    );
    expect(d).not.toBeNull();
    expect(chaseHandoverPhase(d, now)).toBe("now");
  });

  it("a manual chase today resets the hand-over clock (no boomerang)", () => {
    const d = chaseHandoverDate(
      { chaseCount: 2, firstChasedAt: days(-20), lastChasedAt: days(-10), lastEngagedAt: null, lastManualChaseAt: now },
      7,
      now,
    );
    // Next hand-over is a full repeat gap away — off the queue entirely.
    expect(chaseHandoverPhase(d, now)).toBeNull();
  });

  it("a manual chase also resets the 14-day silence backstop", () => {
    const d = chaseHandoverDate(
      { chaseCount: 1, firstChasedAt: days(-20), lastChasedAt: days(-20), lastEngagedAt: null, lastManualChaseAt: days(-1) },
      7,
      now,
    );
    expect(chaseHandoverPhase(d, now)).toBeNull();
  });

  it("client engagement after the manual chase still pauses the cap path", () => {
    const d = chaseHandoverDate(
      { chaseCount: 2, firstChasedAt: days(-20), lastChasedAt: days(-10), lastEngagedAt: days(-1), lastManualChaseAt: days(-2) },
      7,
      now,
    );
    // Cap path paused by engagement; only the silence backstop remains, anchored
    // at the engagement — 14 days out, so nothing surfaces today.
    expect(chaseHandoverPhase(d, now)).toBeNull();
  });

  it("never-chased steps still have no hand-over", () => {
    expect(chaseHandoverDate({ chaseCount: 0, firstChasedAt: null, lastChasedAt: null, lastEngagedAt: null }, 7, now)).toBeNull();
  });

  it("honours a custom per-rule escalate cap", () => {
    const snap = { chaseCount: 2, firstChasedAt: days(-6), lastChasedAt: days(-1), lastEngagedAt: null };
    // Default cap (2): count-cap path is live — last chase (−1d) + 7d repeat is
    // 6 days out, so nothing surfaces yet, but the cap path IS engaged.
    expect(chaseHandoverPhase(chaseHandoverDate(snap, 7, now), now)).toBeNull();
    // Raise the cap to 4: chaseCount (2) < cap, so the count path is dormant and
    // only the (far-off) 14-day silence backstop remains — still nothing today.
    const higher = chaseHandoverDate(snap, 7, now, 4);
    expect(chaseHandoverPhase(higher, now)).toBeNull();
    // Lower the cap to 1: chaseCount (2) >= cap, count path fires on last chase +
    // repeat. With a 1-day repeat and a chase 3 days ago, it's already overdue.
    const lower = chaseHandoverDate({ ...snap, lastChasedAt: days(-3) }, 1, now, 1);
    expect(chaseHandoverPhase(lower, now)).toBe("now");
  });
});
