// Enquiries tracker service (enquiries rework, Stage 1.6).
//
// The read + mutations behind the internal tracker panel. Callers (server
// actions) enforce access scope before invoking these.

import { prisma } from "@/lib/prisma";
import { addWorkingDays } from "@/lib/emails/working-hours";
import {
  ENQUIRY_FIRST_CHASE_WORKING_DAYS as FIRST_CHASE_DAYS,
  ENQUIRY_REPEAT_CHASE_WORKING_DAYS as REPEAT_CHASE_DAYS,
  ENQUIRY_ESCALATE_WORKING_DAYS as ESCALATE_DAYS,
  ENQUIRY_CHASE_SNOOZE_WORKING_DAYS,
} from "./cadence";

// The minimal clock fields the reply-loop cadence math reads. Kept structural so
// both the DB view (getEnquiryTrackerView) and the chase timeline can pass their
// already-fetched tracker rows without re-querying.
export type EnquiryChaseClock = {
  openedAt: Date;
  lastMovementAt: Date | null;
  lastChasedAt: Date | null;
  escalatedAt: Date | null;
  snoozedUntil: Date | null;
  closedAt: Date | null;
};

// The date the NEXT reply-loop chase will send, or null when nothing more sends
// (closed, snoozed, or already escalated — we stop auto-chasing on escalation).
// First chase 6 working days after the anchor, then every 5. Single source of
// truth: the file panel AND the chase timeline both read this, so the predicted
// date can never disagree with when the cron actually fires.
export function enquiryNextChaseAt(t: EnquiryChaseClock, now: Date = new Date()): Date | null {
  const snoozed = !!(t.snoozedUntil && t.snoozedUntil > now);
  if (t.closedAt || snoozed || t.escalatedAt) return null;
  const anchor = t.lastMovementAt ?? t.openedAt;
  return t.lastChasedAt
    ? addWorkingDays(t.lastChasedAt, REPEAT_CHASE_DAYS)
    : addWorkingDays(anchor, FIRST_CHASE_DAYS);
}

// The date this loop escalates to the file owner if no reply lands, or null when
// it's already escalated or closed. Measured from the last movement (silence
// resets on any logged movement), matching the cron.
export function enquiryEscalateAt(t: EnquiryChaseClock, now: Date = new Date()): Date | null {
  void now;
  if (t.closedAt || t.escalatedAt) return null;
  const anchor = t.lastMovementAt ?? t.openedAt;
  return addWorkingDays(anchor, ESCALATE_DAYS);
}

// When an open loop is resting (not surfaced), or null if it needs you now.
// "Resting" = an explicit set date still in the future (a solicitor's promised
// date, or a manual park) OR the short chase leash still running (chased less than
// ENQUIRY_CHASE_SNOOZE_WORKING_DAYS ago). It rests until the LATER of the two, so a
// chase never shortens a standing promise, and a promise never hides the fact you
// chased. (critique #1/#2)
export function enquiryRestingUntil(t: EnquiryChaseClock, now: Date = new Date()): Date | null {
  const dates: Date[] = [];
  if (t.snoozedUntil && t.snoozedUntil > now) dates.push(t.snoozedUntil);
  if (t.lastChasedAt) {
    const leash = addWorkingDays(t.lastChasedAt, ENQUIRY_CHASE_SNOOZE_WORKING_DAYS);
    if (leash > now) dates.push(leash);
  }
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

// The single live "needs you now" test — the source of truth for BOTH the nav-bar
// enquiries count and the hub "gone quiet" card, so they always agree (critique
// #6). Not resting AND either: you chased and the leash elapsed (your move again —
// a movement nulls lastChasedAt, so a set value means no reply since), or it was
// never chased since the last movement and silence has passed the escalation
// threshold (genuinely stalled). Distinguish the two with enquiryStalled below.
export function enquiryNeedsAttention(t: EnquiryChaseClock, now: Date = new Date()): boolean {
  if (t.closedAt) return false;
  if (enquiryRestingUntil(t, now)) return false;
  if (t.lastChasedAt) return true;
  const anchor = t.lastMovementAt ?? t.openedAt;
  return addWorkingDays(anchor, ESCALATE_DAYS) <= now;
}

// True only for the ALARMING kind of attention: gone dark past the threshold with
// nobody chasing (red "stalled"). A loop you're actively chasing needs you too,
// but reads as the calmer "chase again", not red. (critique #2/#3)
export function enquiryStalled(t: EnquiryChaseClock, now: Date = new Date()): boolean {
  return enquiryNeedsAttention(t, now) && !t.lastChasedAt;
}

export type EnquiryCourt = "seller_solicitor" | "buyer_solicitor";
export type EnquiryTrackerStatus = "closed" | "snoozed" | "stalled" | "chasing";
export type EnquiryMovementKind =
  | "raised" | "replies_sent" | "replies_received" | "chased" | "update" | "correction"
  // Seller's solicitor sent SOME replies across (not all): the ball stays their
  // court, the clock resets, and the partialRepliesAt flag is raised.
  | "partial_replies";

export type EnquiryMovementView = {
  id: string;
  note: string;
  occurredAt: Date;
  source: string;
  kind: EnquiryMovementKind;
  flipsCourtTo: EnquiryCourt | null;
};

export type EnquiryTrackerView = {
  currentlyWith: EnquiryCourt;
  outstandingNote: string | null;
  openedAt: Date;
  lastMovementAt: Date | null;
  closedAt: Date | null;
  snoozedUntil: Date | null;
  escalated: boolean;
  chaseCount: number;
  status: EnquiryTrackerStatus;
  // Live "needs you"/rest model shared with the triage page (critique parity).
  // restingUntil = the LATER of a promised date/park and the chase leash, or null
  // when it needs you now; restingReason says which so the panel can word it.
  restingUntil: Date | null;
  restingReason: "promise" | "chased" | null;
  needsAttention: boolean; // your move now (not resting)
  stalled: boolean; // gone dark, nobody chasing (red vs the amber "chase again")
  // True when the sale is on hold — the panel shows a paused note instead of a
  // live "next chase" line (F4).
  paused: boolean;
  nextChaseAt: Date | null;
  // Non-null when some (not all) replies are in and the ball is still their court.
  partialRepliesAt: Date | null;
  movements: EnquiryMovementView[];
};

// Display-shaped view of the loop for the file panel. Returns null when the
// enquiries stage hasn't opened yet (no tracker).
export async function getEnquiryTrackerView(
  transactionId: string,
  now: Date = new Date(),
): Promise<EnquiryTrackerView | null> {
  const t = await prisma.enquiryTracker.findUnique({
    where: { transactionId },
    include: {
      movements: { where: { status: "accepted" }, orderBy: { occurredAt: "desc" }, take: 20 },
      transaction: { select: { status: true } },
    },
  });
  if (!t) return null;
  // A withdrawn / fallen-through sale: hide the box entirely rather than let a
  // closed tracker read as "Enquiries satisfied". On hold: keep the box but flag
  // it paused so the panel says so instead of a live "next chase" line. (F4)
  if (t.transaction?.status === "withdrawn") return null;
  const paused = t.transaction?.status === "on_hold";

  // Live model (critique #2/#6): resting = a promised date/park or the chase leash;
  // stalled = gone dark past the threshold with nobody chasing. Keeps the file
  // panel consistent with the triage page + nav count.
  const restingUntil = enquiryRestingUntil(t, now);
  const promiseFuture = !!(t.snoozedUntil && t.snoozedUntil > now);
  const restingReason: "promise" | "chased" | null = restingUntil ? (promiseFuture ? "promise" : "chased") : null;
  const needsAttention = enquiryNeedsAttention(t, now);
  const stalled = enquiryStalled(t, now);
  const status: EnquiryTrackerStatus = t.closedAt
    ? "closed"
    : restingUntil
      ? "snoozed"
      : stalled
        ? "stalled"
        : "chasing";

  // Single source of truth for the next-chase date (shared with the chase
  // timeline via enquiryNextChaseAt, so the panel and the timeline agree).
  const nextChaseAt = enquiryNextChaseAt(t, now);

  return {
    currentlyWith: t.currentlyWith as EnquiryCourt,
    outstandingNote: t.outstandingNote,
    openedAt: t.openedAt,
    lastMovementAt: t.lastMovementAt,
    closedAt: t.closedAt,
    snoozedUntil: t.snoozedUntil,
    escalated: !!t.escalatedAt,
    chaseCount: t.chaseCount,
    status,
    restingUntil,
    restingReason,
    needsAttention,
    stalled,
    paused,
    nextChaseAt,
    partialRepliesAt: t.partialRepliesAt,
    movements: t.movements.map((m) => ({
      id: m.id,
      note: m.note,
      occurredAt: m.occurredAt,
      source: m.source,
      kind: m.kind as EnquiryMovementKind,
      flipsCourtTo: (m.flipsCourtTo as EnquiryCourt | null) ?? null,
    })),
  };
}

// Log a movement in the loop. Resets the chase (so an active file isn't nudged
// as if it were silent) and clears any stalled flag; if the ball moved, flips
// the court. This is the signal that keeps the chase honest.
export type EnquiryMovementSource = "progressor" | "buyer_report" | "seller_report" | "solicitor_reply";

// How a movement affects the chase clock and the court:
//  - "handover" (the default, and what every existing caller relies on): the
//    ball genuinely moved. Restarts the 6/5-working-day cadence + clears any
//    stalled flag, and flips the court when a side is given.
//  - "touch": the same side has been in touch but still holds the ball.
//    Restarts the cadence + clears stalled, but does NOT flip the court.
//  - "relabel": a pure correction of whose court it is (we mislabelled it).
//    Flips the court but leaves the clock and the stalled flag exactly where
//    they were, so the wait keeps counting from the real last movement.
export type EnquiryMovementMode = "handover" | "touch" | "relabel";

export async function logEnquiryMovement(args: {
  transactionId: string;
  note: string;
  flipsCourtTo?: EnquiryCourt | null;
  createdByUserId?: string | null;
  occurredAt?: Date;
  // Who this movement came from. Defaults to the internal team; a solicitor
  // replying via /s/<token> passes "solicitor_reply".
  source?: EnquiryMovementSource;
  // Defaults to the historical behaviour (reset the clock, flip if a side is
  // given). Only the panel's "correct who has it" control passes "relabel".
  mode?: EnquiryMovementMode;
  // Event type for the triage page's pills + history. Defaults to "update".
  kind?: EnquiryMovementKind;
}): Promise<boolean> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId: args.transactionId },
    select: { id: true, closedAt: true, openedAt: true },
  });
  if (!tracker || tracker.closedAt) return false;
  const now = new Date();
  const relabel = args.mode === "relabel";

  // Backdate support: when the caller says it happened earlier, anchor the
  // whole cadence (lastMovementAt → next chase + "for N days") to that date,
  // not to now. Clamp to [openedAt, now] so it can't predate the loop or sit
  // in the future. Absent → today, exactly as before.
  const anchorAt = args.occurredAt
    ? new Date(Math.min(now.getTime(), Math.max(tracker.openedAt.getTime(), args.occurredAt.getTime())))
    : now;

  const isPartial = args.kind === "partial_replies";
  const flips = args.flipsCourtTo ?? null;

  await prisma.$transaction([
    prisma.enquiryMovement.create({
      data: {
        trackerId: tracker.id,
        note: args.note.trim(),
        occurredAt: anchorAt,
        source: args.source ?? "progressor",
        kind: args.kind ?? "update",
        flipsCourtTo: flips,
        status: "accepted",
        createdByUserId: args.createdByUserId ?? null,
      },
    }),
    prisma.enquiryTracker.update({
      where: { id: tracker.id },
      data: relabel
        ? // Correction only: move the court, leave the cadence + stall alone.
          { ...(flips ? { currentlyWith: flips } : {}) }
        : {
            lastMovementAt: anchorAt,
            lastChasedAt: null, // any movement clears the chase leash (they responded)
            escalatedAt: null, // no longer stalled
            // The solicitor's promised date means "ALL replies by then". Clear it
            // only when the court FLIPS — full replies moving to the buyer, or a
            // fresh round raised — not on a same-side partial/touch, which still
            // owes the rest by that date. (critique #4)
            ...(flips ? { snoozedUntil: null } : {}),
            ...(flips ? { currentlyWith: flips } : {}),
            // Partial-flag lifecycle: a partial movement raises it; a movement
            // that FLIPS the court (full replies across / fresh round) clears
            // it; a same-side touch ("still with them", a chase) leaves it as
            // it was, so the "some replies in" signal survives a later chase.
            ...(isPartial ? { partialRepliesAt: anchorAt } : flips ? { partialRepliesAt: null } : {}),
          },
    }),
  ]);

  // A court flip changes whether the PM20 "enquiries satisfied" chase may run
  // (#63): defers it while the ball is with the seller, un-defers it once full
  // replies land with the buyer. Recompute this file's reminders so the change
  // lands immediately. Dynamic import avoids a static cycle with the engine.
  if (flips) {
    import("@/lib/services/reminders")
      .then((m) => m.evaluateTransactionReminders(args.transactionId))
      .catch(() => {});
  }
  return true;
}

// Chase leash (critique #2/#10). A chase where you HAVEN'T heard back — either a
// sent nudge or the manual "I've chased" tap — quiets the loop for a short window
// (ENQUIRY_CHASE_SNOOZE_WORKING_DAYS), then it surfaces again as a "needs you"
// number. Unlike a real movement, it does NOT reset the long silence clock
// (lastMovementAt), so a loop that's been with them for weeks floats to the top
// when it wakes. It also flags escalatedAt (preserving an earlier one) so the
// nav-bar count picks it up the moment the leash elapses — computed live, no
// stored flag. The leash is derived from lastChasedAt (+ ENQUIRY_CHASE_SNOOZE_
// WORKING_DAYS) so it NEVER touches snoozedUntil (the solicitor's promised date)
// or escalatedAt (genuine stall). See enquiryNeedsAttention / enquiryRestingUntil.
//
// recordMovement=true writes a "chased" row for the history (the button, which
// sends nothing). The email-send path logs its own chase comm, so it passes false.
export async function markEnquiryChased(args: {
  transactionId: string;
  createdByUserId?: string | null;
  recordMovement?: boolean;
  note?: string;
}): Promise<boolean> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId: args.transactionId },
    select: { id: true, closedAt: true },
  });
  if (!tracker || tracker.closedAt) return false;
  const now = new Date();
  await prisma.$transaction([
    ...(args.recordMovement
      ? [prisma.enquiryMovement.create({
          data: {
            trackerId: tracker.id,
            note: (args.note ?? "Chased, awaiting a reply").trim(),
            occurredAt: now,
            source: "progressor",
            kind: "chased",
            status: "accepted",
            createdByUserId: args.createdByUserId ?? null,
          },
        })]
      : []),
    prisma.enquiryTracker.update({
      where: { id: tracker.id },
      data: {
        lastChasedAt: now,
        chaseCount: { increment: 1 },
      },
    }),
  ]);
  return true;
}

export async function setEnquiryOutstandingNote(transactionId: string, note: string | null): Promise<void> {
  const clean = note && note.trim() ? note.trim() : null;
  await prisma.enquiryTracker.updateMany({ where: { transactionId }, data: { outstandingNote: clean } });
}

// Snooze the chase for N working days (or clear the snooze with null).
export async function setEnquirySnooze(transactionId: string, workingDays: number | null): Promise<void> {
  const until = workingDays && workingDays > 0 ? addWorkingDays(new Date(), workingDays) : null;
  await prisma.enquiryTracker.updateMany({ where: { transactionId }, data: { snoozedUntil: until } });
}

// Snooze the chase until a specific calendar date. Used when a solicitor gives
// an expected date via /s/<token> — we hold the chase off until then rather
// than nudging over a date they've already committed to. Past/blank dates are
// ignored (no-op) so a mistaken value can't silently disable the chase forever.
export async function setEnquirySnoozeUntil(transactionId: string, date: Date | null): Promise<void> {
  const until = date && date.getTime() > Date.now() ? date : null;
  if (!until) return;
  await prisma.enquiryTracker.updateMany({ where: { transactionId, closedAt: null }, data: { snoozedUntil: until } });
}
