// The "get enquiries raised" chase — pure timing brain (enquiries rework).
//
// Runs BEFORE the enquiries tracker exists, to get the buyer's solicitor to
// raise enquiries. All timings are WORKING DAYS from when searches were ordered
// (the chase's openedAt). Founder-approved schedule (2026-08-14):
//
//   WD 7   nudge the buyer            (their solicitor usually tells them first)
//   WD 10  chase the buyer's solicitor (7 + 3)
//   WD 13  escalate to the file owner  (3 WD after the solicitor's first email)
//   +6 WD  repeat, alternating buyer / solicitor, until raised
//
// Holds entirely while a promised "expected raised by" date is still in the
// future (that date lives on the PM14 MilestoneCompletion.expectedDate).

import { addWorkingDays } from "@/lib/emails/working-hours";

export type RaiseChaseTarget = "buyer" | "buyer_solicitor";

export type RaiseChaseState = {
  openedAt: Date; // searches ordered — the clock anchor
  lastNudgedAt: Date | null;
  lastTarget: RaiseChaseTarget | null;
  nudgeCount: number;
  escalatedAt: Date | null;
  // The buyer's/solicitor's promised "raised by" date (PM14 expectedDate), if any.
  expectedDate: Date | null;
};

export type RaiseChaseDecision = {
  nudgeDue: boolean;
  target: RaiseChaseTarget | null; // who to nudge when nudgeDue is true
  escalateDue: boolean;
};

// Founder-approved constants.
const GRACE_BUYER_WD = 7; // first buyer nudge, from searches ordered
const SOLICITOR_GAP_WD = 3; // solicitor chase, this many WD after the buyer nudge
const ESCALATE_AFTER_SOLICITOR_WD = 3; // escalate this many WD after the solicitor chase
const REPEAT_WD = 6; // repeat cadence once past the opening two nudges

const SOLICITOR_AT_WD = GRACE_BUYER_WD + SOLICITOR_GAP_WD; // 10
const ESCALATE_AT_WD = SOLICITOR_AT_WD + ESCALATE_AFTER_SOLICITOR_WD; // 13

export function raiseChaseDecision(s: RaiseChaseState, now: Date): RaiseChaseDecision {
  // Hold everything while we're inside a promised date that hasn't passed.
  if (s.expectedDate && s.expectedDate > now) {
    return { nudgeDue: false, target: null, escalateDue: false };
  }

  // Escalation fires once, at the 2-week + 3-day ceiling.
  const escalateDue = !s.escalatedAt && now >= addWorkingDays(s.openedAt, ESCALATE_AT_WD);

  // Nudge schedule.
  let nudgeDue = false;
  let target: RaiseChaseTarget | null = null;
  if (s.nudgeCount === 0) {
    target = "buyer";
    nudgeDue = now >= addWorkingDays(s.openedAt, GRACE_BUYER_WD);
  } else if (s.nudgeCount === 1) {
    target = "buyer_solicitor";
    nudgeDue = now >= addWorkingDays(s.openedAt, SOLICITOR_AT_WD);
  } else {
    // Alternate from whoever we nudged last; repeat every REPEAT_WD.
    target = s.lastTarget === "buyer" ? "buyer_solicitor" : "buyer";
    const anchor = s.lastNudgedAt ?? s.openedAt;
    nudgeDue = now >= addWorkingDays(anchor, REPEAT_WD);
  }

  return { nudgeDue, target, escalateDue };
}
