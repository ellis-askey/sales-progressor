// Per-file preview of automated emails for the file-detail "Reminders" tab.
// Three buckets:
//   pending    — OutboundEmailQueue rows on this transaction not yet sent
//   sentToday  — OutboundEmailQueue rows sent in the last 24h (Europe/London-aware)
//   upcoming   — predicted next chase fire date per active ClientChaseState
//
// Read-only — no DB writes. Pure projection of current state.
//
// The "upcoming" prediction duplicates a slice of findDueClientChases logic
// from lib/services/client-chase-cron.ts. Kept in sync via the constants
// imported from that module (CLIENT_CHASE_COUNT_CAP) and verified by
// scripts/verify-emails-preview.ts (TODO follow-up). Sunday-skip applied
// to match the vercel.json cron-schedule restriction.

import { prisma } from "@/lib/prisma";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { CLIENT_CHASE_COUNT_CAP } from "@/lib/services/client-chase-cron";

export type PendingEmail = {
  id: string;
  emailType: string;
  category: "chase" | "notification";
  recipientName: string;
  recipientRole: string;
  subject: string;
  scheduledFor: Date;
};

export type SentEmail = {
  id: string;
  emailType: string;
  category: "chase" | "notification";
  recipientName: string;
  recipientRole: string;
  subject: string;
  sentAt: Date;
};

export type UpcomingChase = {
  contactId: string;
  contactName: string;
  contactRole: string;
  milestoneCode: string;
  milestoneLabel: string;
  predictedFireDate: Date;
  // 1-indexed: "chase 2 of 2" means this is the next-to-fire send.
  chaseNumber: number;
};

export type AutomatedEmailsPreview = {
  pending: PendingEmail[];
  sentToday: SentEmail[];
  upcoming: UpcomingChase[];
};

const UPCOMING_WINDOW_DAYS = 14;

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// Sunday is UTC day-of-week 0. If the candidate date is Sunday, push to Monday.
// Matches the Mon-Sat cron schedule restriction so predicted dates align with
// when the cron will actually fire.
function nextNonSundayFrom(d: Date): Date {
  if (d.getUTCDay() === 0) return addDays(d, 1);
  return d;
}

// Category classification for the chip in the drawer/card. "chase" covers
// CLIENT_CHASE rows (digest emails to clients) plus the predicted upcoming
// items. Everything else is a generic "notification" (chain notifications,
// milestone confirm emails, etc.).
function categoriseEmailType(emailType: string): "chase" | "notification" {
  return emailType === "CLIENT_CHASE" ? "chase" : "notification";
}

// London-zone start of day. Approximation good enough for "today" buckets —
// we use a UTC midnight that's "early enough" to capture the local day in
// either GMT or BST. Falls back gracefully near DST boundaries.
function startOfTodayLondon(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getAutomatedEmailsForTransaction(
  transactionId: string,
  now: Date = new Date(),
): Promise<AutomatedEmailsPreview> {
  const startOfDay = startOfTodayLondon(now);
  const upcomingHorizon = addDays(now, UPCOMING_WINDOW_DAYS);

  // ─── Pending (queued, not yet sent) ─────────────────────────────────
  const pendingRows = await prisma.outboundEmailQueue.findMany({
    where: {
      sentAt: null,
      errorAt: null,
      recipientContact: { propertyTransactionId: transactionId },
    },
    include: {
      recipientContact: {
        select: { id: true, name: true, roleType: true },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  // ─── Sent today (last 24h-ish, London day boundary) ─────────────────
  const sentTodayRows = await prisma.outboundEmailQueue.findMany({
    where: {
      sentAt: { gte: startOfDay },
      recipientContact: { propertyTransactionId: transactionId },
    },
    include: {
      recipientContact: {
        select: { id: true, name: true, roleType: true },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  const pending: PendingEmail[] = pendingRows.map((r) => {
    const payload = (r.payload ?? {}) as { subject?: string };
    return {
      id: r.id,
      emailType: r.emailType,
      category: categoriseEmailType(r.emailType),
      recipientName: r.recipientContact?.name ?? "(unknown)",
      recipientRole: r.recipientContact?.roleType ?? "",
      subject: payload.subject ?? "(no subject)",
      scheduledFor: r.scheduledFor,
    };
  });

  const sentToday: SentEmail[] = sentTodayRows
    .filter((r) => r.sentAt != null)
    .map((r) => {
      const payload = (r.payload ?? {}) as { subject?: string };
      return {
        id: r.id,
        emailType: r.emailType,
        category: categoriseEmailType(r.emailType),
        recipientName: r.recipientContact?.name ?? "(unknown)",
        recipientRole: r.recipientContact?.roleType ?? "",
        subject: payload.subject ?? "(no subject)",
        sentAt: r.sentAt!,
      };
    });

  // ─── Upcoming (predicted from active ClientChaseState) ──────────────
  // Skip rows where:
  //   - status !== active (completed / escalated / opted_out have no chase ahead)
  //   - chaseCount >= cap (no more chase emails; escalation territory)
  //   - chaseCount === 0 (no firstChasedAt; would need anchor lookup — v1 skip)
  //   - lastEngagedAt > lastChasedAt (engagement paused the loop)
  const ccsRows = await prisma.clientChaseState.findMany({
    where: {
      transactionId,
      status: "active",
      chaseCount: { gt: 0, lt: CLIENT_CHASE_COUNT_CAP },
    },
    select: {
      contactId: true,
      milestoneCode: true,
      chaseCount: true,
      lastChasedAt: true,
      lastEngagedAt: true,
      contact: {
        select: { id: true, name: true, roleType: true },
      },
    },
  });

  // Bulk-load ReminderRule rows for repeatEveryDays lookup
  const codes = Array.from(new Set(ccsRows.map((r) => r.milestoneCode)));
  const rules = codes.length > 0
    ? await prisma.reminderRule.findMany({
        where: { isActive: true, targetMilestoneCode: { in: codes } },
        select: { targetMilestoneCode: true, repeatEveryDays: true },
      })
    : [];
  const repeatByCode = new Map<string, number>();
  for (const r of rules) {
    if (r.targetMilestoneCode) repeatByCode.set(r.targetMilestoneCode, r.repeatEveryDays);
  }

  const upcoming: UpcomingChase[] = [];
  for (const row of ccsRows) {
    if (!row.lastChasedAt) continue;
    // Engagement gate: if engaged after the last chase, no upcoming chase.
    if (row.lastEngagedAt && row.lastEngagedAt > row.lastChasedAt) continue;
    const repeat = repeatByCode.get(row.milestoneCode);
    if (repeat == null) continue;
    const candidate = addDays(row.lastChasedAt, repeat);
    const predicted = nextNonSundayFrom(candidate);
    if (predicted > upcomingHorizon) continue;
    upcoming.push({
      contactId: row.contactId,
      contactName: row.contact?.name ?? "(unknown)",
      contactRole: row.contact?.roleType ?? "",
      milestoneCode: row.milestoneCode,
      milestoneLabel: getMilestoneCopy(row.milestoneCode).label,
      predictedFireDate: predicted,
      chaseNumber: row.chaseCount + 1,
    });
  }
  // Earliest-firing first
  upcoming.sort((a, b) => a.predictedFireDate.getTime() - b.predictedFireDate.getTime());

  return { pending, sentToday, upcoming };
}
