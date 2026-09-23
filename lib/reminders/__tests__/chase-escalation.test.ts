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
});
