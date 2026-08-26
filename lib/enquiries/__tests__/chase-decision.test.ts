import { enquiryChaseDecision } from "@/lib/enquiries/chase";
import { addWorkingDays } from "@/lib/emails/working-hours";

const anchor = new Date("2026-09-01T09:00:00Z"); // a Tuesday

type Over = Partial<{
  openedAt: Date;
  lastMovementAt: Date | null;
  lastChasedAt: Date | null;
  escalatedAt: Date | null;
  snoozedUntil: Date | null;
}>;
const tracker = (over: Over = {}) => ({
  openedAt: anchor,
  lastMovementAt: null,
  lastChasedAt: null,
  escalatedAt: null,
  snoozedUntil: null,
  ...over,
});

describe("enquiryChaseDecision", () => {
  it("no chase before 7 working days", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 6))).toEqual({ chaseDue: false, escalateDue: false });
  });

  it("chase due at 7 working days, no escalation yet", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 7))).toEqual({ chaseDue: true, escalateDue: false });
  });

  it("escalates at 13 working days (~2.5 weeks) of silence", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 13)).escalateDue).toBe(true);
  });

  it("does not escalate before 13 working days", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 12)).escalateDue).toBe(false);
  });

  it("does not re-escalate once already escalated", () => {
    const now = addWorkingDays(anchor, 20);
    expect(enquiryChaseDecision(tracker({ escalatedAt: now }), now).escalateDue).toBe(false);
  });

  it("repeat cadence runs from the last chase", () => {
    const lastChasedAt = addWorkingDays(anchor, 7);
    expect(enquiryChaseDecision(tracker({ lastChasedAt }), addWorkingDays(lastChasedAt, 6)).chaseDue).toBe(false);
    expect(enquiryChaseDecision(tracker({ lastChasedAt }), addWorkingDays(lastChasedAt, 7)).chaseDue).toBe(true);
  });

  it("a logged movement resets both clocks", () => {
    const lastMovementAt = addWorkingDays(anchor, 20);
    expect(enquiryChaseDecision(tracker({ lastMovementAt }), addWorkingDays(lastMovementAt, 2))).toEqual({
      chaseDue: false,
      escalateDue: false,
    });
  });

  it("snooze suppresses chase and escalation", () => {
    const now = addWorkingDays(anchor, 20);
    expect(enquiryChaseDecision(tracker({ snoozedUntil: addWorkingDays(now, 3) }), now)).toEqual({
      chaseDue: false,
      escalateDue: false,
    });
  });
});
