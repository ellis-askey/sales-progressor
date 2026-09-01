// Enquiries tracker service (enquiries rework, Stage 1.6).
//
// The read + mutations behind the internal tracker panel. Callers (server
// actions) enforce access scope before invoking these.

import { prisma } from "@/lib/prisma";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { ENQUIRY_CHASE_WORKING_DAYS as CHASE_WORKING_DAYS } from "./cadence";

export type EnquiryCourt = "seller_solicitor" | "buyer_solicitor";
export type EnquiryTrackerStatus = "closed" | "snoozed" | "stalled" | "chasing";

export type EnquiryMovementView = {
  id: string;
  note: string;
  occurredAt: Date;
  source: string;
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
  nextChaseAt: Date | null;
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
    },
  });
  if (!t) return null;

  const snoozed = !!(t.snoozedUntil && t.snoozedUntil > now);
  const status: EnquiryTrackerStatus = t.closedAt ? "closed" : snoozed ? "snoozed" : t.escalatedAt ? "stalled" : "chasing";

  const anchor = t.lastMovementAt ?? t.openedAt;
  const nextChaseAt =
    t.closedAt || snoozed
      ? null
      : t.lastChasedAt
        ? addWorkingDays(t.lastChasedAt, CHASE_WORKING_DAYS)
        : addWorkingDays(anchor, CHASE_WORKING_DAYS);

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
    nextChaseAt,
    movements: t.movements.map((m) => ({
      id: m.id,
      note: m.note,
      occurredAt: m.occurredAt,
      source: m.source,
      flipsCourtTo: (m.flipsCourtTo as EnquiryCourt | null) ?? null,
    })),
  };
}

// Compact state for the property-file hero "whose court" chip. Spans the whole
// enquiries period: the pre-raise leg (waiting on the buyer's solicitor to
// raise enquiries, read-only) and the live reply loop (the slider). Returns
// null before enquiries start and once they're satisfied.
export type EnquiryHeroPhase = "raising" | "loop";
export type EnquiryHeroState = {
  phase: EnquiryHeroPhase;
  currentlyWith: EnquiryCourt;
  status: "chasing" | "snoozed" | "stalled";
  interactive: boolean; // the slider is live only in the reply loop
  nextChaseAt: Date | null;
};

export async function getEnquiryHeroState(
  transactionId: string,
  now: Date = new Date(),
): Promise<EnquiryHeroState | null> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId },
    select: {
      currentlyWith: true,
      closedAt: true,
      snoozedUntil: true,
      escalatedAt: true,
      openedAt: true,
      lastMovementAt: true,
      lastChasedAt: true,
    },
  });
  if (tracker) {
    if (tracker.closedAt) return null; // enquiries satisfied, the period is over
    const snoozed = !!(tracker.snoozedUntil && tracker.snoozedUntil > now);
    const status = snoozed ? "snoozed" : tracker.escalatedAt ? "stalled" : "chasing";
    const anchor = tracker.lastMovementAt ?? tracker.openedAt;
    const nextChaseAt = snoozed
      ? null
      : tracker.lastChasedAt
        ? addWorkingDays(tracker.lastChasedAt, CHASE_WORKING_DAYS)
        : addWorkingDays(anchor, CHASE_WORKING_DAYS);
    return {
      phase: "loop",
      currentlyWith: tracker.currentlyWith as EnquiryCourt,
      status,
      interactive: true,
      nextChaseAt,
    };
  }

  // No tracker yet: if the pre-raise chase is running, the ball sits with the
  // buyer's solicitor (they must raise). Read-only until enquiries are raised.
  const raise = await prisma.enquiryRaiseChase.findUnique({
    where: { transactionId },
    select: { closedAt: true, escalatedAt: true },
  });
  if (raise && !raise.closedAt) {
    return {
      phase: "raising",
      currentlyWith: "buyer_solicitor",
      status: raise.escalatedAt ? "stalled" : "chasing",
      interactive: false,
      nextChaseAt: null,
    };
  }
  return null;
}

// Log a movement in the loop. Resets the chase (so an active file isn't nudged
// as if it were silent) and clears any stalled flag; if the ball moved, flips
// the court. This is the signal that keeps the chase honest.
export type EnquiryMovementSource = "progressor" | "buyer_report" | "seller_report" | "solicitor_reply";

// How a movement affects the chase clock and the court:
//  - "handover" (the default, and what every existing caller relies on): the
//    ball genuinely moved. Restarts the 9-working-day cadence + clears any
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
}): Promise<boolean> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId: args.transactionId },
    select: { id: true, closedAt: true },
  });
  if (!tracker || tracker.closedAt) return false;
  const now = new Date();
  const relabel = args.mode === "relabel";
  await prisma.$transaction([
    prisma.enquiryMovement.create({
      data: {
        trackerId: tracker.id,
        note: args.note.trim(),
        occurredAt: args.occurredAt ?? now,
        source: args.source ?? "progressor",
        flipsCourtTo: args.flipsCourtTo ?? null,
        status: "accepted",
        createdByUserId: args.createdByUserId ?? null,
      },
    }),
    prisma.enquiryTracker.update({
      where: { id: tracker.id },
      data: relabel
        ? // Correction only: move the court, leave the cadence + stall alone.
          { ...(args.flipsCourtTo ? { currentlyWith: args.flipsCourtTo } : {}) }
        : {
            lastMovementAt: now,
            lastChasedAt: null, // restart the 9-day cadence from this movement
            escalatedAt: null, // no longer stalled
            ...(args.flipsCourtTo ? { currentlyWith: args.flipsCourtTo } : {}),
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
