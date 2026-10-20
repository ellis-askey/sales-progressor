import { enquiryChaseDecision } from "@/lib/enquiries/chase";
import { addWorkingDays } from "@/lib/emails/working-hours";

const anchor = new Date("2026-09-01T09:00:00Z"); // a Tuesday

type Over = Partial<{
  openedAt: Date;
  lastMovementAt: Date | null;
  lastChasedAt: Date | null;
  lastTouchAt: Date | null;
  escalatedAt: Date | null;
  snoozedUntil: Date | null;
  awaitingPackAt: Date | null;
}>;
const tracker = (over: Over = {}) => ({
  openedAt: anchor,
  lastMovementAt: null,
  lastChasedAt: null,
  lastTouchAt: null,
  escalatedAt: null,
  snoozedUntil: null,
  awaitingPackAt: null,
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

  // Audit ENQ-001 — the "waiting on management pack" hold previously paused the
  // UI (no next chase, out of needs-you) while the cron kept chasing AND
  // escalating. The hold must silence the cron exactly like a snooze, however
  // overdue the file is, until PM12 auto-wakes it or the agent clears it.
  it("a management-pack hold suppresses chase and escalation indefinitely", () => {
    const now = addWorkingDays(anchor, 40); // far past chase + escalation ceilings
    expect(enquiryChaseDecision(tracker({ awaitingPackAt: addWorkingDays(anchor, 2) }), now)).toEqual({
      chaseDue: false,
      escalateDue: false,
    });
  });

  it("clearing the pack hold resumes the normal cadence", () => {
    const now = addWorkingDays(anchor, 6);
    expect(enquiryChaseDecision(tracker({ awaitingPackAt: null }), now).chaseDue).toBe(true);
  });

  // #282 — a soft "touch" (still with them / solicitors spoken) buys a SHORT
  // 3-working-day breather, not a fresh 6, and never resets the escalation clock.
  it("a touch chases again after 3 working days, not 6", () => {
    const lastTouchAt = addWorkingDays(anchor, 8);
    expect(enquiryChaseDecision(tracker({ lastTouchAt }), addWorkingDays(lastTouchAt, 2)).chaseDue).toBe(false);
    expect(enquiryChaseDecision(tracker({ lastTouchAt }), addWorkingDays(lastTouchAt, 3)).chaseDue).toBe(true);
  });

  it("a touch does NOT reset the escalation clock (honest escalation)", () => {
    // Touched on day 12 of silence; escalation still fires at day 13 from the open.
    const lastTouchAt = addWorkingDays(anchor, 12);
    expect(enquiryChaseDecision(tracker({ lastTouchAt }), addWorkingDays(anchor, 13)).escalateDue).toBe(true);
  });

  it("a chase supersedes an earlier touch (repeat cadence, not the touch breather)", () => {
    const lastTouchAt = addWorkingDays(anchor, 8);
    const lastChasedAt = addWorkingDays(anchor, 9); // chased AFTER the touch
    // 3 WD after the touch would be due, but the later chase pushes it to 5 WD out.
    expect(enquiryChaseDecision(tracker({ lastTouchAt, lastChasedAt }), addWorkingDays(lastChasedAt, 4)).chaseDue).toBe(false);
    expect(enquiryChaseDecision(tracker({ lastTouchAt, lastChasedAt }), addWorkingDays(lastChasedAt, 5)).chaseDue).toBe(true);
  });
});
