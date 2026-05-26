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
import { CLIENT_CHASE_COUNT_CAP, CLIENT_CHASE_GRACE_FLOOR_DAYS } from "@/lib/services/client-chase-cron";
import { setUkChaseTime } from "@/lib/services/reminders";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import type { ContactRole } from "@prisma/client";

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

  // ─── Upcoming (predicted) — two kinds combined ──────────────────────
  //
  // Kind 1: REPEAT chases — predict next-fire from active CCS rows with
  //         chaseCount in (0, cap). Logic = lastChasedAt + repeatEveryDays,
  //         engagement-gated. Excludes paused-after-engagement rows.
  //
  // Kind 2: FIRST chases — predict when a milestone's first chase will
  //         fire. For each chaseable rule × eligible contact where there's
  //         no CCS row yet AND the target milestone is "available" AND
  //         the anchor is satisfied: compute anchor + max(grace, floor),
  //         Sunday-skip, include if within horizon. Mirrors the same
  //         setup logic as findDueClientChases in client-chase-cron.ts.
  //
  // Both kinds load from a shared set of bulk queries (rules + defs +
  // completions + contacts + all-ccs-rows for this transaction) so the
  // total query count stays small.

  const [allCcsRows, allActiveRules, allDefs, allCompletions, contacts, transaction, snoozedReminders] = await Promise.all([
    prisma.clientChaseState.findMany({
      where: { transactionId },
      select: {
        contactId: true,
        milestoneCode: true,
        status: true,
        chaseCount: true,
        lastChasedAt: true,
        lastEngagedAt: true,
        contact: { select: { id: true, name: true, roleType: true } },
      },
    }),
    prisma.reminderRule.findMany({
      where: { isActive: true, targetMilestoneCode: { not: null } },
      select: {
        targetMilestoneCode: true,
        anchorMilestoneId: true,
        graceDays: true,
        repeatEveryDays: true,
        useEventDate: true,
        requiresExchangeReady: true,
      },
    }),
    prisma.milestoneDefinition.findMany({
      select: { id: true, code: true, blocksExchange: true },
    }),
    prisma.milestoneCompletion.findMany({
      where: { transactionId },
      select: {
        milestoneDefinitionId: true,
        state: true,
        completedAt: true,
        eventDate: true,
        reconciledAtClaim: true,
      },
    }),
    prisma.contact.findMany({
      where: {
        propertyTransactionId: transactionId,
        roleType: { in: ["vendor", "purchaser"] },
        unsubscribedAt: null,
        email: { not: null },
        portalToken: { not: null },
      },
      select: { id: true, name: true, roleType: true },
    }),
    prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { createdAt: true, status: true, chaseRuleSnapshot: true },
    }),
    // Snooze suppression: chases predicted here are hidden for milestones
    // whose ReminderLog is currently snoozed. Matches the same suppression
    // applied in findDueClientChases — preview reflects what will actually
    // fire, not just what could theoretically fire.
    prisma.reminderLog.findMany({
      where: {
        transactionId,
        status: "active",
        snoozedUntil: { gt: now },
      },
      select: { reminderRule: { select: { targetMilestoneCode: true } } },
    }),
  ]);
  const snoozedCodes = new Set(
    snoozedReminders
      .map((r) => r.reminderRule.targetMilestoneCode)
      .filter((c): c is string => c !== null),
  );

  // Per-transaction snapshot read (same source the cron uses for timing).
  // Settings edits to ReminderRule don't affect this file's predictions;
  // the snapshot captured at creation time wins. Falls back to live rule
  // values if the snapshot is missing/malformed.
  type SnapEntry = { graceDays?: number; repeatEveryDays?: number };
  type Snap = Record<string, SnapEntry | undefined>;
  const snap: Snap = (transaction?.chaseRuleSnapshot && typeof transaction.chaseRuleSnapshot === "object")
    ? (transaction.chaseRuleSnapshot as Snap)
    : {};
  function snapTiming(code: string): { graceDays?: number; repeatEveryDays?: number } {
    const e = snap[code];
    if (!e) return {};
    return {
      graceDays: typeof e.graceDays === "number" ? e.graceDays : undefined,
      repeatEveryDays: typeof e.repeatEveryDays === "number" ? e.repeatEveryDays : undefined,
    };
  }

  const chaseableRules = allActiveRules.filter((r) =>
    r.targetMilestoneCode != null && isClientChaseable(r.targetMilestoneCode),
  );
  const defByCode = new Map(allDefs.map((d) => [d.code, d.id]));
  const blockerDefIds = new Set(allDefs.filter((d) => d.blocksExchange).map((d) => d.id));
  const completionByDefId = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c]));
  const existingCcsKeys = new Set(allCcsRows.map((r) => `${r.contactId}:${r.milestoneCode}`));

  const upcoming: UpcomingChase[] = [];

  // ── Kind 1: REPEAT chases from active CCS rows ──────────────────────
  const liveRepeatByCode = new Map<string, number>();
  for (const r of chaseableRules) {
    if (r.targetMilestoneCode) liveRepeatByCode.set(r.targetMilestoneCode, r.repeatEveryDays);
  }
  for (const row of allCcsRows) {
    if (row.status !== "active") continue;
    if (row.chaseCount <= 0 || row.chaseCount >= CLIENT_CHASE_COUNT_CAP) continue;
    if (!row.lastChasedAt) continue;
    // Engagement gate
    if (row.lastEngagedAt && row.lastEngagedAt > row.lastChasedAt) continue;
    // Snooze suppression — match the cron's chase-skip behaviour.
    if (snoozedCodes.has(row.milestoneCode)) continue;
    const repeat = snapTiming(row.milestoneCode).repeatEveryDays ?? liveRepeatByCode.get(row.milestoneCode);
    if (repeat == null) continue;
    const candidate = addDays(row.lastChasedAt, repeat);
    // Normalise to 09:30 UK so the preview matches the actual send time
    // (cron uses setUkChaseTime when scheduling chase tasks).
    const predicted = setUkChaseTime(nextNonSundayFrom(candidate));
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

  // ── Kind 2: FIRST chases (milestone available, no CCS row yet) ──────
  // Requires the transaction to be active (closed/declined files don't
  // chase) — short-circuit if status differs.
  if (transaction && transaction.status === "active") {
    const exchangeReady = Array.from(blockerDefIds).every((defId) => {
      const c = completionByDefId.get(defId);
      return c && (c.state === "complete" || c.state === "not_required");
    });

    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    for (const rule of chaseableRules) {
      const code = rule.targetMilestoneCode;
      if (!code) continue;
      const targetDefId = defByCode.get(code);
      if (!targetDefId) continue;

      // Target must currently be "available" to be chaseable
      const targetComp = completionByDefId.get(targetDefId);
      if (!targetComp || targetComp.state !== "available") continue;

      // Exchange-ready gate (matches cron)
      if (rule.requiresExchangeReady && !exchangeReady) continue;

      // Snooze suppression — match the cron's chase-skip behaviour.
      if (snoozedCodes.has(code)) continue;

      // Compute anchor date with the same precedence as the cron's
      // computeAnchorDate (reconciledAtClaim → eventDate; useEventDate;
      // else completedAt; null-anchor rules use transaction.createdAt).
      let anchorDate: Date | null = null;
      if (rule.anchorMilestoneId) {
        const ac = completionByDefId.get(rule.anchorMilestoneId);
        if (!ac || ac.state !== "complete") continue; // anchor not yet done
        if (ac.reconciledAtClaim) {
          anchorDate = ac.eventDate ?? null;
        } else if (rule.useEventDate && ac.eventDate) {
          anchorDate = ac.eventDate;
        } else {
          anchorDate = ac.completedAt ?? transaction.createdAt;
        }
      } else {
        anchorDate = transaction.createdAt;
      }
      if (!anchorDate) continue;

      // First-due date with the grace floor + Sunday-skip. Snapshot
      // graceDays wins over the live rule when present.
      const graceFromSnap = snapTiming(code).graceDays;
      const grace = Math.max(graceFromSnap ?? rule.graceDays, CLIENT_CHASE_GRACE_FLOOR_DAYS);
      let firstDue = addDays(anchorDate, grace);
      // Past-due → normalise to today; cron will fire on the next non-Sunday run.
      if (firstDue < todayStart) firstDue = todayStart;
      firstDue = setUkChaseTime(nextNonSundayFrom(firstDue));
      if (firstDue > upcomingHorizon) continue;

      // Recipient side from code prefix (matches cron's sideForMilestoneCode)
      const side: ContactRole | null =
        code.startsWith("VM") ? "vendor"
        : code.startsWith("PM") ? "purchaser"
        : null;
      if (!side) continue;
      const recipients = contacts.filter((c) => c.roleType === side);

      for (const contact of recipients) {
        // Skip if a CCS row of any status already exists — repeat-kind
        // (or skip-because-completed/escalated/opted-out) already handles it.
        if (existingCcsKeys.has(`${contact.id}:${code}`)) continue;

        upcoming.push({
          contactId: contact.id,
          contactName: contact.name,
          contactRole: contact.roleType,
          milestoneCode: code,
          milestoneLabel: getMilestoneCopy(code).label,
          predictedFireDate: firstDue,
          chaseNumber: 1, // first chase
        });
      }
    }
  }

  // Earliest-firing first
  upcoming.sort((a, b) => a.predictedFireDate.getTime() - b.predictedFireDate.getTime());

  return { pending, sentToday, upcoming };
}
