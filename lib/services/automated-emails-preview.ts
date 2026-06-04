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
import { assembleMilestoneDigest, type MilestoneDigestPayload } from "@/lib/email/milestone-digest";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
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

// Truthful delivery state derived from SendGrid Event Webhook columns.
// "unknown" means we handed the message off but no event has come back
// yet — covers historical rows pre-PR-3 too. Most-bad-wins ordering:
// bounced/blocked dominate, then deferred (unresolved), then delivered.
export type DeliveryStatus = "delivered" | "deferred" | "bounced" | "blocked" | "unknown";

export type SentEmail = {
  id: string;
  emailType: string;
  category: "chase" | "notification";
  recipientName: string;
  recipientRole: string;
  subject: string;
  sentAt: Date;
  // PR 3 — populated from OutboundEmailQueue delivery columns
  deliveryStatus: DeliveryStatus;
  deliveredAt: Date | null;
  deferredAt: Date | null;
  deferredCount: number;
  deferredReason: string | null;
  bouncedAt: Date | null;
  bouncedReason: string | null;
  blockedAt: Date | null;
  blockedReason: string | null;
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

// Pause-state visibility for the auto-emails surface. Three independent
// layers can each suppress the chase cron; we collapse to a single
// activePauseReason for display (most-global wins — see
// AutomatedEmailsCard for the rationale). When activePauseReason is null
// the file's chase pipeline is healthy.
//
// globalDisabled  — CLIENT_CHASE_ENABLED env var off (no file fires anywhere)
// agencyDisabled  — agency.chaseEmailsEnabled = false (no file in this agency fires)
// fileDisabled    — propertyTransaction.clientEmailsPaused = true (this single file)
export type PauseState = {
  globalDisabled: boolean;
  agencyDisabled: boolean;
  fileDisabled: boolean;
  activePauseReason: "global" | "agency" | "file" | null;
  // Only populated when activePauseReason === "agency", for the pill label.
  agencyName: string | null;
};

export type AutomatedEmailsPreview = {
  pending: PendingEmail[];
  sentToday: SentEmail[];
  upcoming: UpcomingChase[];
  pauseState: PauseState;
};

// Strict-equals match for the chase cron's own gate (lib/api/cron/client-chase).
// Anything other than the literal string "true" leaves chases globally dormant.
function getChaseGlobalDisabled(): boolean {
  return process.env.CLIENT_CHASE_ENABLED !== "true";
}

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

// Derive truthful delivery status from the SendGrid webhook columns.
// Priority: bounced/blocked > deferred (unresolved) > delivered >
// unknown. "deferred AND delivered" reads as delivered (SendGrid
// retried successfully). "bounced AND delivered" shouldn't happen but
// we treat bounced as winning (something went wrong after delivery).
type DeliveryColumns = {
  deliveredAt: Date | null;
  deferredAt: Date | null;
  bouncedAt: Date | null;
  blockedAt: Date | null;
};
function deriveDeliveryStatus(r: DeliveryColumns): DeliveryStatus {
  if (r.bouncedAt) return "bounced";
  if (r.blockedAt) return "blocked";
  if (r.deliveredAt) return "delivered";
  if (r.deferredAt) return "deferred";
  return "unknown";
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

  // Pre-2026-06-03 this function ran two outboundEmailQueue queries
  // serially (~600-1000ms combined) THEN a 7-query Promise.all for the
  // upcoming-chase prediction. None of the 9 queries depend on each
  // other, so they're now folded into one wave. Total time becomes
  // max(slowest query) instead of sum(serial chain + slowest of seven).
  const [
    pendingRows,
    sentTodayRows,
    allCcsRows,
    allActiveRules,
    allDefs,
    allCompletions,
    contacts,
    transaction,
    snoozedReminders,
  ] = await Promise.all([
    // Pending (queued, not yet sent)
    prisma.outboundEmailQueue.findMany({
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
    }),

    // Sent today (last 24h-ish, London day boundary)
    prisma.outboundEmailQueue.findMany({
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
    }),

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
    // Round-scoped: this preview simulates the chase engine's
    // evaluateTransactionReminders for the agent UI. The live engine
    // (lib/services/reminders.ts, converted in 4c) reads VM file-level
    // + active round's PMs; the preview must match exactly or the
    // displayed "what would fire" diverges from what actually fires.
    (async () => {
      const txRow = await prisma.propertyTransaction.findUnique({
        where: { id: transactionId },
        select: { activeBuyerRoundId: true },
      });
      const scope = forRound(txRow?.activeBuyerRoundId ?? null, transactionId);
      return prisma.milestoneCompletion.findMany({
        where: { transactionId, ...milestoneScopeWhere(scope) },
        select: {
          milestoneDefinitionId: true,
          state: true,
          completedAt: true,
          eventDate: true,
          reconciledAtClaim: true,
        },
      });
    })(),
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
      select: {
        createdAt: true,
        status: true,
        chaseRuleSnapshot: true,
        // Pause-state inputs (added 2026-05-29 for the auto-emails honesty pass)
        clientEmailsPaused: true,
        agency: { select: { name: true, chaseEmailsEnabled: true } },
      },
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

  // ─── Sent today: collapse digest bundles into one row per send ──────
  //
  // MILESTONE_CONFIRMATION rows are drained in groups (one per recipient
  // contact per drain run); when N >= 2 rows for the same contact are
  // drained together, they're sent as ONE digest email but each queue
  // row still gets sentAt = the drain's `new Date()`. So same
  // (recipientContactId, sentAt-ms) = same physical SendGrid send.
  //
  // We collapse by that pair: groups of 1 keep the per-event subject;
  // groups of >=2 re-assemble the digest subject so the UI shows what
  // landed in the inbox rather than what was queued. Other emailTypes
  // (CLIENT_CHASE, RETENTION_*, chain notifications) are never bundled
  // by the drain — they pass through one-row-per-row unchanged.
  const sentTodayValid = sentTodayRows.filter((r) => r.sentAt != null);
  const milestoneRows = sentTodayValid.filter((r) => r.emailType === "MILESTONE_CONFIRMATION");
  const otherRows = sentTodayValid.filter((r) => r.emailType !== "MILESTONE_CONFIRMATION");

  const milestoneGroups = new Map<string, typeof milestoneRows>();
  for (const r of milestoneRows) {
    if (!r.recipientContactId || !r.sentAt) continue;
    const key = `${r.recipientContactId}:${r.sentAt.getTime()}`;
    const existing = milestoneGroups.get(key) ?? [];
    existing.push(r);
    milestoneGroups.set(key, existing);
  }

  const collapsedMilestone: SentEmail[] = [];
  for (const group of milestoneGroups.values()) {
    if (group.length === 1) {
      const r = group[0];
      const payload = (r.payload ?? {}) as { subject?: string };
      collapsedMilestone.push({
        id: r.id,
        emailType: r.emailType,
        category: categoriseEmailType(r.emailType),
        recipientName: r.recipientContact?.name ?? "(unknown)",
        recipientRole: r.recipientContact?.roleType ?? "",
        subject: payload.subject ?? "(no subject)",
        sentAt: r.sentAt!,
        deliveryStatus: deriveDeliveryStatus(r),
        deliveredAt: r.deliveredAt,
        deferredAt: r.deferredAt,
        deferredCount: r.deferredCount,
        deferredReason: r.deferredReason,
        bouncedAt: r.bouncedAt,
        bouncedReason: r.bouncedReason,
        blockedAt: r.blockedAt,
        blockedReason: r.blockedReason,
      });
      continue;
    }
    // Bundled — re-derive the digest subject from the same payloads the
    // drain assembled. Wrap in try/catch in case any payload is malformed
    // (would otherwise crash the whole preview).
    const first = group[0];
    let digestSubject = "Updates";
    try {
      const payloads = group.map((r) => r.payload as unknown as MilestoneDigestPayload);
      const assembled = assembleMilestoneDigest(payloads);
      digestSubject = assembled.subject;
    } catch {
      // Defensive: keep the bundled row visible with a generic subject
      // rather than dropping it from the feed.
    }
    // Bundle delivery status: the webhook fans events out to every row
    // in the bundle (via the comma-joined queueId customArg), so all
    // rows in the group should already share the same delivery state.
    // Reading from `first` is correct.
    collapsedMilestone.push({
      id: first.id,
      emailType: first.emailType,
      category: categoriseEmailType(first.emailType),
      recipientName: first.recipientContact?.name ?? "(unknown)",
      recipientRole: first.recipientContact?.roleType ?? "",
      subject: digestSubject,
      sentAt: first.sentAt!,
      deliveryStatus: deriveDeliveryStatus(first),
      deliveredAt: first.deliveredAt,
      deferredAt: first.deferredAt,
      deferredCount: first.deferredCount,
      deferredReason: first.deferredReason,
      bouncedAt: first.bouncedAt,
      bouncedReason: first.bouncedReason,
      blockedAt: first.blockedAt,
      blockedReason: first.blockedReason,
    });
  }

  const otherSent: SentEmail[] = otherRows.map((r) => {
    const payload = (r.payload ?? {}) as { subject?: string };
    return {
      id: r.id,
      emailType: r.emailType,
      category: categoriseEmailType(r.emailType),
      recipientName: r.recipientContact?.name ?? "(unknown)",
      recipientRole: r.recipientContact?.roleType ?? "",
      subject: payload.subject ?? "(no subject)",
      sentAt: r.sentAt!,
      deliveryStatus: deriveDeliveryStatus(r),
      deliveredAt: r.deliveredAt,
      deferredAt: r.deferredAt,
      deferredCount: r.deferredCount,
      deferredReason: r.deferredReason,
      bouncedAt: r.bouncedAt,
      bouncedReason: r.bouncedReason,
      blockedAt: r.blockedAt,
      blockedReason: r.blockedReason,
    };
  });

  // Merged + most-recent-first to match the existing UI ordering.
  const sentToday: SentEmail[] = [...collapsedMilestone, ...otherSent]
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

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
  // Both kinds load from the shared bulk-query wave above (rules + defs
  // + completions + contacts + all-ccs-rows for this transaction).
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

  // Pause-state — three independent layers collapsed to one display reason
  // with most-global priority. Used by AutomatedEmailsCard to show the
  // pause pill + per-row chips.
  const globalDisabled = getChaseGlobalDisabled();
  const agencyDisabled = transaction?.agency?.chaseEmailsEnabled === false;
  const fileDisabled = transaction?.clientEmailsPaused === true;
  const activePauseReason: PauseState["activePauseReason"] =
    globalDisabled ? "global"
    : agencyDisabled ? "agency"
    : fileDisabled ? "file"
    : null;
  const pauseState: PauseState = {
    globalDisabled,
    agencyDisabled,
    fileDisabled,
    activePauseReason,
    agencyName: activePauseReason === "agency" ? transaction?.agency?.name ?? null : null,
  };

  return { pending, sentToday, upcoming, pauseState };
}
