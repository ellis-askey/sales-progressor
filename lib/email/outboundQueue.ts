// lib/email/outboundQueue.ts
// Quiet-hours scheduling for exchange, completion, and celebration emails.
// Business window: Mon–Fri 08:00–19:00 Europe/London (BST-aware via Intl).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendChainEmail, isUserEmailSuppressed, isContactEmailSuppressed } from "@/lib/email";

// ─── Business-hours scheduling ─────────────────────────────────────────────────

function getLondonParts(d: Date) {
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hourFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  });
  const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  });
  const [yearStr, monthStr, dayStr] = dateFmt.format(d).split("-");
  return {
    year: parseInt(yearStr),
    month: parseInt(monthStr) - 1, // 0-indexed for Date.UTC
    day: parseInt(dayStr),
    hour: parseInt(hourFmt.format(d)),
    weekday: weekdayFmt.format(d), // "Mon"–"Sun"
  };
}

function nextWeekdayAfter(d: Date): { year: number; month: number; day: number } {
  let candidate = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const parts = getLondonParts(candidate);
    if (!["Sat", "Sun"].includes(parts.weekday)) {
      return { year: parts.year, month: parts.month, day: parts.day };
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  const parts = getLondonParts(candidate);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function getLondon8amUTC(year: number, month: number, day: number): Date {
  // London is UTC+0 (GMT) or UTC+1 (BST) — 08:00 London = 07:00 or 08:00 UTC
  for (const utcHour of [6, 7, 8]) {
    const candidate = new Date(Date.UTC(year, month, day, utcHour, 0, 0));
    const londonHour = parseInt(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
      }).format(candidate),
    );
    if (londonHour === 8) return candidate;
  }
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}

export function scheduleForBusinessHours(now: Date): Date {
  const OPEN = 8;
  const CLOSE = 19;
  const parts = getLondonParts(now);
  const isWeekday = !["Sat", "Sun"].includes(parts.weekday);

  if (isWeekday && parts.hour >= OPEN && parts.hour < CLOSE) return now;

  let target: { year: number; month: number; day: number };
  if (!isWeekday || parts.hour >= CLOSE) {
    target = nextWeekdayAfter(now);
  } else {
    // Weekday before OPEN — use today at 08:00
    target = { year: parts.year, month: parts.month, day: parts.day };
  }
  return getLondon8amUTC(target.year, target.month, target.day);
}

// ─── Enqueue ───────────────────────────────────────────────────────────────────

// Enqueue an outbound email for business-hours delivery. Caller must supply
// EXACTLY ONE of recipientUserId / recipientContactId — the DB CHECK
// constraint enforces this, but the runtime assertion fails fast at the
// call site (clearer error than a P2002 unique-violation later).
//
// recipientUserId path is the existing one (claimed agents, chain
// notifications). recipientContactId path is new in A5 of the client-chase
// arc — used by Sub-arc B's digest sender when targeting vendor / purchaser
// / solicitor / broker contacts.
//
// scheduledFor override: callers that want to bypass the business-hours
// window can pass an explicit Date. Used by the milestone-confirmation
// batching layer — transactional client emails should fire 24/7 within
// a short batching window rather than waiting for next business hours.
// Pass undefined (default) for the existing business-hours behaviour.
export async function enqueueEmail({
  emailType,
  sourceId,
  recipientEmail,
  recipientUserId,
  recipientContactId,
  payload,
  scheduledFor,
}: {
  emailType: string;
  sourceId: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientContactId?: string;
  payload: Record<string, unknown>;
  scheduledFor?: Date;
}): Promise<void> {
  // Exactly-one-recipient invariant — catches developer error before the DB
  // CHECK constraint would. The constraint is the source of truth; this is
  // the friendlier surface for misuse.
  const hasUser = !!recipientUserId;
  const hasContact = !!recipientContactId;
  if (hasUser === hasContact) {
    throw new Error(
      `[enqueueEmail] exactly one of recipientUserId / recipientContactId must be set ` +
      `(got userId=${hasUser ? "set" : "null"}, contactId=${hasContact ? "set" : "null"})`,
    );
  }

  const resolvedScheduledFor = scheduledFor ?? scheduleForBusinessHours(new Date());
  try {
    await prisma.outboundEmailQueue.create({
      data: {
        emailType,
        sourceId,
        recipientEmail,
        recipientUserId: recipientUserId ?? null,
        recipientContactId: recipientContactId ?? null,
        payload: payload as Prisma.InputJsonValue,
        scheduledFor: resolvedScheduledFor,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code !== "P2002") throw e;
    // P2002 = unique constraint — already queued or already sent, skip silently
  }
}

// ─── Drain (called by hourly cron) ─────────────────────────────────────────────

export async function drainOutboundQueue(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const now = new Date();
  const due = await prisma.outboundEmailQueue.findMany({
    where: {
      sentAt: null,
      errorAt: null,
      scheduledFor: { lte: now },
      // MILESTONE_CONFIRMATION rows are drained by the dedicated 3-minute
      // /api/cron/send-milestone-digests cron (digest assembly + send).
      // Excluded here to avoid double-processing under the hourly drain.
      emailType: { not: "MILESTONE_CONFIRMATION" },
    },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of due) {
    // Dispatch the suppression check to the right helper based on which
    // recipient column is set. CHECK constraint guarantees exactly one is
    // non-null; defensively skip records that somehow violate it (e.g.
    // direct SQL inserts pre-A5 wouldn't have either, though such rows
    // can't exist because the constraint was added BEFORE this code path).
    let suppressed = false;
    let recipientLogId = "";
    if (record.recipientUserId) {
      suppressed = await isUserEmailSuppressed(record.recipientUserId);
      recipientLogId = `userId=${record.recipientUserId}`;
    } else if (record.recipientContactId) {
      suppressed = await isContactEmailSuppressed(record.recipientContactId);
      recipientLogId = `contactId=${record.recipientContactId}`;
    } else {
      // Should never happen — CHECK constraint blocks this. Log loudly and
      // skip rather than crash the drain loop.
      console.error(
        `[EMAIL_FAIL] type=${record.emailType} id=${record.id} reason=no_recipient_columns_set`,
      );
      await prisma.outboundEmailQueue.update({
        where: { id: record.id },
        data: { errorAt: new Date(), errorMessage: "no_recipient_columns_set" },
      });
      failed++;
      continue;
    }

    if (suppressed) {
      await prisma.outboundEmailQueue.update({
        where: { id: record.id },
        data: { sentAt: new Date(), errorMessage: "suppressed:unsubscribed" },
      });
      console.log(
        `[EMAIL_SKIP] type=${record.emailType} ${recipientLogId} reason=unsubscribed`,
      );
      skipped++;
      continue;
    }

    const payload = record.payload as Record<string, unknown>;
    try {
      await sendChainEmail({
        to: record.recipientEmail,
        subject: payload.subject as string,
        text: payload.text as string,
        html: payload.html as string | undefined,
        queueId: record.id,
      });
      await prisma.outboundEmailQueue.update({
        where: { id: record.id },
        data: { sentAt: new Date() },
      });
      console.log(`[EMAIL_SENT] type=${record.emailType} to=${record.recipientEmail}`);
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "send error";
      await prisma.outboundEmailQueue.update({
        where: { id: record.id },
        data: { errorAt: new Date(), errorMessage: message },
      });
      console.error(
        `[EMAIL_FAIL] type=${record.emailType} to=${record.recipientEmail} err=${message}`,
      );
      failed++;
    }
  }

  return { sent, skipped, failed };
}
