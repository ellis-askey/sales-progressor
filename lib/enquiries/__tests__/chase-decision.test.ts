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
  it("no chase before 6 working days", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 5))).toEqual({ chaseDue: false, escalateDue: false });
  });

  it("first chase due at 6 working days, no escalation yet", () => {
    expect(enquiryChaseDecision(tracker(), addWorkingDays(anchor, 6))).toEqual({ chaseDue: true, escalateDue: false });
  });

  it("repeat cadence runs 5 working days from the last chase", () => {
    const lastChasedAt = addWorkingDays(anchor, 6);
    expect(enquiryChaseDecision(tracker({ lastChasedAt }), addWorkingDays(lastChasedAt, 4)).chaseDue).toBe(false);
    expect(enquiryChaseDecision(tracker({ lastChasedAt }), addWorkingDays(lastChasedAt, 5)).chaseDue).toBe(true);
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

  it("stops auto-chasing once escalated (handed to the hub)", () => {
    const now = addWorkingDays(anchor, 20); // a chase would otherwise be due
    const d = enquiryChaseDecision(tracker({ escalatedAt: addWorkingDays(anchor, 13), lastChasedAt: addWorkingDays(anchor, 11) }), now);
    expect(d.chaseDue).toBe(false);
    expect(d.escalateDue).toBe(false);
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
