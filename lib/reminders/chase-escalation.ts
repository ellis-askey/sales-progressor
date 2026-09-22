// Compute-on-read hand-over schedule for a client-autopilot chase.
//
// The client autopilot chases a step, then is meant to hand it to a human once
// it gives up. That hand-over is written by a daily cron — and if the cron
// stalls, the step is hidden forever (see the "we miss things" investigation).
//
// This module derives the hand-over schedule directly from the chase state
// (dates we already have), so the work queue can surface a chased-out step on a
// fixed schedule WITHOUT depending on the cron writing anything:
//
//   final autopilot chase + repeatEveryDays          → the day it enters "Needs you"
//   that day − CHASE_HANDOVER_LEAD_DAYS              → the day it enters "Coming up"
//
// Plus a 14-day silence backstop that also catches a chase the autopilot never
// finished (stalled after one chase). Mirrors the cron's escalation triggers
// (lib/services/client-chase-cron.ts) so the read side and the cron agree.

export const CHASE_HANDOVER_CAP = 2; // matches CLIENT_CHASE_COUNT_CAP
export const CHASE_HANDOVER_SILENCE_DAYS = 14; // no progress this long → hand over
export const CHASE_HANDOVER_LEAD_DAYS = 3; // show in "Coming up" this many days early

export type ChaseSnapshot = {
  chaseCount: number;
  firstChasedAt: Date | null;
  lastChasedAt: Date | null;
  lastEngagedAt: Date | null;
};

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// The day a chase should land in "Needs you", or null if it's still actively
// chasing / paused by engagement. Whichever trigger is EARLIER wins (mirrors the
// cron's whichever-hits-first). `repeatEveryDays` is the step's repeat gap.
export function chaseHandoverDate(s: ChaseSnapshot, repeatEveryDays: number, now: Date): Date | null {
  void now; // schedule is date-only; the caller decides now-vs-schedule via chaseHandoverPhase
  if (!s.firstChasedAt) return null; // never chased → nothing to hand over yet

  // Engagement pauses the clock (caller aggregates couple-as-one).
  const engagedAfterLastChase = !!(s.lastEngagedAt && s.lastChasedAt && s.lastEngagedAt > s.lastChasedAt);

  const dates: Date[] = [];

  // Count-cap path: the final autopilot chase + the repeat gap.
  if (s.chaseCount >= CHASE_HANDOVER_CAP && s.lastChasedAt && !engagedAfterLastChase) {
    dates.push(addDays(s.lastChasedAt, Math.max(repeatEveryDays, 1)));
  }

  // 14-day silence backstop, anchored at the later of first-chase / last-engaged.
  // This also surfaces a chase the autopilot stalled on (never sent its 2nd chase).
  const silenceAnchor = s.lastEngagedAt && s.lastEngagedAt > s.firstChasedAt ? s.lastEngagedAt : s.firstChasedAt;
  dates.push(addDays(silenceAnchor, CHASE_HANDOVER_SILENCE_DAYS));

  return dates.reduce((min, d) => (d < min ? d : min));
}

export type HandoverPhase = "now" | "soon" | null;

// "now"  → on/after the hand-over date        → Needs you
// "soon" → within the lead window before it   → Coming up
// null   → still on autopilot / not near it
export function chaseHandoverPhase(handoverDate: Date | null, now: Date): HandoverPhase {
  if (!handoverDate) return null;
  if (now.getTime() >= handoverDate.getTime()) return "now";
  if (now.getTime() >= addDays(handoverDate, -CHASE_HANDOVER_LEAD_DAYS).getTime()) return "soon";
  return null;
}
