// Unit tests for the enquiry-chase cadence helpers that the chase timeline reads
// to predict the next send + escalation date (enquiry-chase-timeline-parity).
// Deterministic cases only (null branches + target alternation + relative
// ordering) so they don't depend on the working-day / bank-holiday calendar.

import { enquiryNextChaseAt, enquiryEscalateAt, type EnquiryChaseClock } from "../tracker";
import {
  raiseChaseTargetNext,
  raiseChaseNextNudgeAt,
  raiseChaseEscalateAt,
  type RaiseChaseState,
} from "../raise-chase-decision";

const NOW = new Date("2026-10-05T09:00:00.000Z"); // a Monday

function clock(overrides: Partial<EnquiryChaseClock> = {}): EnquiryChaseClock {
  return {
    openedAt: new Date("2026-09-01T09:00:00.000Z"),
    lastMovementAt: null,
    lastChasedAt: null,
    escalatedAt: null,
    snoozedUntil: null,
    closedAt: null,
    ...overrides,
  };
}

describe("enquiryNextChaseAt", () => {
  it("returns a future date when active and never chased (first chase from the anchor)", () => {
    const next = enquiryNextChaseAt(clock(), NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(new Date("2026-09-01").getTime());
  });

  it("measures the repeat from lastChasedAt once chased", () => {
    const chasedAt = new Date("2026-09-20T09:00:00.000Z");
    const next = enquiryNextChaseAt(clock({ lastChasedAt: chasedAt }), NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(chasedAt.getTime());
  });

  it("returns null when closed, escalated, or snoozed", () => {
    expect(enquiryNextChaseAt(clock({ closedAt: new Date() }), NOW)).toBeNull();
    expect(enquiryNextChaseAt(clock({ escalatedAt: new Date() }), NOW)).toBeNull();
    expect(enquiryNextChaseAt(clock({ snoozedUntil: new Date("2026-11-01") }), NOW)).toBeNull();
  });

  it("ignores an elapsed snooze", () => {
    const next = enquiryNextChaseAt(clock({ snoozedUntil: new Date("2026-09-10") }), NOW);
    expect(next).not.toBeNull();
  });
});

describe("enquiryEscalateAt", () => {
  it("returns a date when active", () => {
    expect(enquiryEscalateAt(clock(), NOW)).not.toBeNull();
  });
  it("returns null once escalated or closed", () => {
    expect(enquiryEscalateAt(clock({ escalatedAt: new Date() }), NOW)).toBeNull();
    expect(enquiryEscalateAt(clock({ closedAt: new Date() }), NOW)).toBeNull();
  });
});

function raise(overrides: Partial<RaiseChaseState> = {}): RaiseChaseState {
  return {
    openedAt: new Date("2026-09-01T09:00:00.000Z"),
    lastNudgedAt: null,
    lastTarget: null,
    nudgeCount: 0,
    escalatedAt: null,
    expectedDate: null,
    ...overrides,
  };
}

describe("raiseChaseTargetNext", () => {
  it("nudges the buyer first, then the buyer's solicitor", () => {
    expect(raiseChaseTargetNext(raise({ nudgeCount: 0 }))).toBe("buyer");
    expect(raiseChaseTargetNext(raise({ nudgeCount: 1 }))).toBe("buyer_solicitor");
  });
  it("alternates from the last target after the opening two", () => {
    expect(raiseChaseTargetNext(raise({ nudgeCount: 2, lastTarget: "buyer" }))).toBe("buyer_solicitor");
    expect(raiseChaseTargetNext(raise({ nudgeCount: 3, lastTarget: "buyer_solicitor" }))).toBe("buyer");
  });
});

describe("raiseChaseNextNudgeAt", () => {
  it("returns a date when active", () => {
    expect(raiseChaseNextNudgeAt(raise())).not.toBeNull();
  });
  it("returns null once escalated", () => {
    expect(raiseChaseNextNudgeAt(raise({ escalatedAt: new Date() }))).toBeNull();
  });
  it("holds behind a later promised 'raised by' date", () => {
    const promised = new Date("2027-01-01T09:00:00.000Z");
    expect(raiseChaseNextNudgeAt(raise({ expectedDate: promised }))).toEqual(promised);
  });
});

describe("raiseChaseEscalateAt", () => {
  it("returns a date when active and null once escalated", () => {
    expect(raiseChaseEscalateAt(raise())).not.toBeNull();
    expect(raiseChaseEscalateAt(raise({ escalatedAt: new Date() }))).toBeNull();
  });
});
