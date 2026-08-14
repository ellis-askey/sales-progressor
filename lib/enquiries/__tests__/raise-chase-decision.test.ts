import { raiseChaseDecision, type RaiseChaseState } from "@/lib/enquiries/raise-chase-decision";
import { addWorkingDays } from "@/lib/emails/working-hours";

const opened = new Date("2026-09-07T09:00:00Z"); // a Monday

function base(over: Partial<RaiseChaseState> = {}): RaiseChaseState {
  return {
    openedAt: opened,
    lastNudgedAt: null,
    lastTarget: null,
    nudgeCount: 0,
    escalatedAt: null,
    expectedDate: null,
    ...over,
  };
}

const buyerAt = addWorkingDays(opened, 7);
const solicitorAt = addWorkingDays(opened, 10);
const escalateAt = addWorkingDays(opened, 13);
const beforeBuyer = new Date(buyerAt.getTime() - 60_000);

describe("raiseChaseDecision — opening nudges", () => {
  test("nothing before the 7-working-day grace", () => {
    const d = raiseChaseDecision(base(), beforeBuyer);
    expect(d.nudgeDue).toBe(false);
    expect(d.escalateDue).toBe(false);
  });

  test("buyer nudge due at working day 7", () => {
    const d = raiseChaseDecision(base(), buyerAt);
    expect(d.nudgeDue).toBe(true);
    expect(d.target).toBe("buyer");
  });

  test("solicitor chase due at working day 10 (after buyer nudged)", () => {
    const d = raiseChaseDecision(base({ nudgeCount: 1, lastTarget: "buyer", lastNudgedAt: buyerAt }), solicitorAt);
    expect(d.nudgeDue).toBe(true);
    expect(d.target).toBe("buyer_solicitor");
  });

  test("solicitor chase NOT due before working day 10", () => {
    const justBefore = new Date(solicitorAt.getTime() - 60_000);
    const d = raiseChaseDecision(base({ nudgeCount: 1, lastTarget: "buyer", lastNudgedAt: buyerAt }), justBefore);
    expect(d.nudgeDue).toBe(false);
  });
});

describe("raiseChaseDecision — escalation", () => {
  test("escalates once at working day 13 if not raised", () => {
    const d = raiseChaseDecision(base({ nudgeCount: 1, lastTarget: "buyer_solicitor", lastNudgedAt: solicitorAt }), escalateAt);
    expect(d.escalateDue).toBe(true);
  });

  test("does not escalate again once escalatedAt is set", () => {
    const d = raiseChaseDecision(
      base({ nudgeCount: 1, lastTarget: "buyer_solicitor", lastNudgedAt: solicitorAt, escalatedAt: escalateAt }),
      new Date(escalateAt.getTime() + 5 * 86_400_000),
    );
    expect(d.escalateDue).toBe(false);
  });

  test("no escalation before the ceiling", () => {
    const d = raiseChaseDecision(base({ nudgeCount: 1 }), new Date(escalateAt.getTime() - 60_000));
    expect(d.escalateDue).toBe(false);
  });
});

describe("raiseChaseDecision — repeat cadence", () => {
  test("alternates back to buyer 6 working days after the solicitor nudge", () => {
    const nextAt = addWorkingDays(solicitorAt, 6);
    const d = raiseChaseDecision(base({ nudgeCount: 2, lastTarget: "buyer_solicitor", lastNudgedAt: solicitorAt }), nextAt);
    expect(d.nudgeDue).toBe(true);
    expect(d.target).toBe("buyer");
  });

  test("not due before the 6-working-day repeat", () => {
    const nextAt = addWorkingDays(solicitorAt, 6);
    const d = raiseChaseDecision(base({ nudgeCount: 2, lastTarget: "buyer_solicitor", lastNudgedAt: solicitorAt }), new Date(nextAt.getTime() - 60_000));
    expect(d.nudgeDue).toBe(false);
  });
});

describe("raiseChaseDecision — expected date holds everything", () => {
  test("a future expected date suppresses nudge and escalation", () => {
    const d = raiseChaseDecision(
      base({ nudgeCount: 1, expectedDate: new Date(escalateAt.getTime() + 10 * 86_400_000) }),
      escalateAt,
    );
    expect(d.nudgeDue).toBe(false);
    expect(d.escalateDue).toBe(false);
  });

  test("a past expected date does not suppress", () => {
    const d = raiseChaseDecision(
      base({ expectedDate: new Date(opened.getTime() - 86_400_000) }),
      buyerAt,
    );
    expect(d.nudgeDue).toBe(true);
  });
});
