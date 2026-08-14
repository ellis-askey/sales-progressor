// Enquiries tracker service (enquiries rework, Stage 1.6).
//
// The read + mutations behind the internal tracker panel. Callers (server
// actions) enforce access scope before invoking these.

import { prisma } from "@/lib/prisma";
import { addWorkingDays } from "@/lib/emails/working-hours";

const CHASE_WORKING_DAYS = 9;

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

// Log a movement in the loop. Resets the chase (so an active file isn't nudged
// as if it were silent) and clears any stalled flag; if the ball moved, flips
// the court. This is the signal that keeps the chase honest.
export type EnquiryMovementSource = "progressor" | "buyer_report" | "seller_report" | "solicitor_reply";

export async function logEnquiryMovement(args: {
  transactionId: string;
  note: string;
  flipsCourtTo?: EnquiryCourt | null;
  createdByUserId?: string | null;
  occurredAt?: Date;
  // Who this movement came from. Defaults to the internal team; a solicitor
  // replying via /s/<token> passes "solicitor_reply".
  source?: EnquiryMovementSource;
}): Promise<boolean> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId: args.transactionId },
    select: { id: true, closedAt: true },
  });
  if (!tracker || tracker.closedAt) return false;
  const now = new Date();
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
      data: {
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
