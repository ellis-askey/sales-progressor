// Automation overview + needs-attention service for /agent/automated-emails.
//
// Powers the "Automation activity" panel (KPIs + per-day chase/notification
// chart) and the "Needs attention" panel (actionable delivery problems).
// Scoped through resolveEmailScope so every number here matches the feed's
// visibility exactly — no aggregate can leak across a viewer's scope.
//
// Honesty rules (per the brief): metrics are only shown when they can be
// derived reliably. Delivery rate = (sent − known failures) / sent — i.e. the
// share not known to have failed (webhook delivery confirmation is partial, so
// we do NOT claim a hard "delivered" percentage). Deltas are real comparisons
// against the immediately-preceding equal-length period.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { toUKDateStr } from "@/lib/utils";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";

const DAY = 86_400_000;

export type OverviewInput = EmailScopeInput & { periodDays: number };

export type AutomationMetrics = {
  emailsSent: number;
  emailsSentDeltaPct: number | null; // vs previous equal-length period
  deliveryRatePct: number | null;    // (sent − known failures) / sent
  issues: number;
  issuesDeltaPct: number | null;
  queuedNow: number;
  filesContacted: number;
  chasesSent: number;
  notificationsSent: number;
};

export type DayBucket = { key: string; label: string; chase: number; notification: number };

export type AutomationOverview = {
  periodDays: number;
  metrics: AutomationMetrics;
  perDay: DayBucket[];
};

const dayLabelFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

// Period-bounded problem predicate for the queue (post-send delivery issues +
// hard send errors + repeated deferrals). from inclusive, to exclusive.
function queueProblemOr(from: Date, to: Date): Prisma.OutboundEmailQueueWhereInput[] {
  return [
    { bouncedAt: { gte: from, lt: to } },
    { blockedAt: { gte: from, lt: to } },
    { errorAt: { gte: from, lt: to } },
    { AND: [{ deferredCount: { gte: 2 } }, { deferredAt: { gte: from, lt: to } }, { deliveredAt: null }] },
  ];
}

function solicitorProblemWhere(scope: Prisma.OutboundMessageWhereInput, from: Date, to: Date): Prisma.OutboundMessageWhereInput {
  return {
    ...scope,
    sentAt: { gte: from, lt: to },
    OR: [{ status: { in: ["failed", "bounced"] } }, { failedAt: { not: null } }],
  };
}

export async function getAutomationOverview(input: OverviewInput): Promise<AutomationOverview> {
  const { txIds, queueScope, solicitorScope } = await resolveEmailScope(input);

  const now = new Date();
  const periodStart = new Date(now.getTime() - input.periodDays * DAY);
  const prevStart = new Date(now.getTime() - 2 * input.periodDays * DAY);

  const emptyMetrics: AutomationMetrics = {
    emailsSent: 0, emailsSentDeltaPct: null, deliveryRatePct: null, issues: 0,
    issuesDeltaPct: null, queuedNow: 0, filesContacted: 0, chasesSent: 0, notificationsSent: 0,
  };
  if (txIds.length === 0) {
    return { periodDays: input.periodDays, metrics: emptyMetrics, perDay: buildEmptyDays(periodStart, now) };
  }

  // Load current-period sent rows once (bounded) — perDay + category counts +
  // filesContacted + delivery failures all derive from these in memory.
  const [queueSent, solSent, queuedNow, emailsSentPrev, issues, issuesPrev] = await Promise.all([
    prisma.outboundEmailQueue.findMany({
      where: { ...queueScope, sentAt: { gte: periodStart } },
      select: {
        sentAt: true, emailType: true, deliveredAt: true, bouncedAt: true, blockedAt: true,
        recipientContact: { select: { propertyTransactionId: true } },
      },
      take: 20000,
    }),
    prisma.outboundMessage.findMany({
      where: { ...solicitorScope, sentAt: { gte: periodStart } },
      select: { sentAt: true, transactionId: true, status: true, failedAt: true },
      take: 20000,
    }),
    prisma.outboundEmailQueue.count({ where: { ...queueScope, sentAt: null, errorAt: null } }),
    // previous equal period sent total (queue + solicitor)
    Promise.all([
      prisma.outboundEmailQueue.count({ where: { ...queueScope, sentAt: { gte: prevStart, lt: periodStart } } }),
      prisma.outboundMessage.count({ where: { ...solicitorScope, sentAt: { gte: prevStart, lt: periodStart } } }),
    ]).then(([a, b]) => a + b),
    // issues this period (queue problems + solicitor failures)
    Promise.all([
      prisma.outboundEmailQueue.count({ where: { ...queueScope, OR: queueProblemOr(periodStart, now) } }),
      prisma.outboundMessage.count({ where: solicitorProblemWhere(solicitorScope, periodStart, now) }),
    ]).then(([a, b]) => a + b),
    // issues previous period
    Promise.all([
      prisma.outboundEmailQueue.count({ where: { ...queueScope, OR: queueProblemOr(prevStart, periodStart) } }),
      prisma.outboundMessage.count({ where: solicitorProblemWhere(solicitorScope, prevStart, periodStart) }),
    ]).then(([a, b]) => a + b),
  ]);

  // Aggregate the sent rows in memory.
  const days = buildEmptyDays(periodStart, now);
  const dayByKey = new Map(days.map((d) => [d.key, d]));
  const files = new Set<string>();
  let chasesSent = 0;
  let notificationsSent = 0;
  let failures = 0;

  for (const r of queueSent) {
    const isChase = r.emailType === "CLIENT_CHASE";
    if (isChase) chasesSent++; else notificationsSent++;
    if (r.recipientContact?.propertyTransactionId) files.add(r.recipientContact.propertyTransactionId);
    if (r.bouncedAt || r.blockedAt) failures++;
    if (r.sentAt) {
      const bucket = dayByKey.get(toUKDateStr(r.sentAt));
      if (bucket) { if (isChase) bucket.chase++; else bucket.notification++; }
    }
  }
  for (const m of solSent) {
    chasesSent++; // solicitor sends are chases
    if (m.transactionId) files.add(m.transactionId);
    if (m.status === "failed" || m.status === "bounced" || m.failedAt) failures++;
    if (m.sentAt) {
      const bucket = dayByKey.get(toUKDateStr(m.sentAt));
      if (bucket) bucket.chase++;
    }
  }

  const emailsSent = queueSent.length + solSent.length;
  const deliveryRatePct = emailsSent > 0
    ? Math.round(((emailsSent - failures) / emailsSent) * 1000) / 10
    : null;

  const metrics: AutomationMetrics = {
    emailsSent,
    emailsSentDeltaPct: pctDelta(emailsSent, emailsSentPrev),
    deliveryRatePct,
    issues,
    issuesDeltaPct: pctDelta(issues, issuesPrev),
    queuedNow,
    filesContacted: files.size,
    chasesSent,
    notificationsSent,
  };

  return { periodDays: input.periodDays, metrics, perDay: days };
}

function buildEmptyDays(from: Date, to: Date): DayBucket[] {
  const out: DayBucket[] = [];
  // Walk London-day keys from `from` to `to` inclusive.
  const cursor = new Date(from.getTime());
  const seen = new Set<string>();
  while (cursor.getTime() <= to.getTime() + DAY) {
    const key = toUKDateStr(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ key, label: dayLabelFmt.format(cursor), chase: 0, notification: 0 });
    }
    cursor.setTime(cursor.getTime() + DAY);
  }
  // Guard against the trailing +DAY producing a future day beyond `to`.
  const todayKey = toUKDateStr(to);
  const idx = out.findIndex((d) => d.key === todayKey);
  return idx >= 0 ? out.slice(0, idx + 1) : out;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ── Needs attention ─────────────────────────────────────────────────────────

export type IssueStatus = "bounced" | "blocked" | "deferred" | "errored" | "failed";
export type IssueAction = "update_contact" | "review";

export type NeedsAttentionItem = {
  emailId: string;
  source: "queue" | "message";
  status: IssueStatus;
  transactionId: string;
  transactionAddress: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  reason: string | null;
  deferredCount: number;
  action: IssueAction; // safe, link-only actions (no send/retry here)
};

export type NeedsAttention = {
  total: number;
  affectedFiles: number;
  byStatus: Record<IssueStatus, number>;
  items: NeedsAttentionItem[]; // highest-priority first, capped
};

const ISSUE_ITEM_CAP = 25;

export async function getNeedsAttention(input: OverviewInput): Promise<NeedsAttention> {
  const { txIds, txAddressById, queueScope, solicitorScope } = await resolveEmailScope(input);
  const empty: NeedsAttention = {
    total: 0, affectedFiles: 0,
    byStatus: { bounced: 0, blocked: 0, deferred: 0, errored: 0, failed: 0 },
    items: [],
  };
  if (txIds.length === 0) return empty;

  const now = new Date();
  const from = new Date(now.getTime() - input.periodDays * DAY);

  const [queueProblems, solProblems] = await Promise.all([
    prisma.outboundEmailQueue.findMany({
      where: { ...queueScope, OR: queueProblemOr(from, now) },
      select: {
        id: true, bouncedAt: true, bouncedReason: true, blockedAt: true, blockedReason: true,
        errorAt: true, errorMessage: true, deferredAt: true, deferredCount: true, deliveredAt: true,
        recipientEmail: true,
        recipientContact: { select: { name: true, roleType: true, propertyTransactionId: true } },
      },
      orderBy: [{ bouncedAt: "desc" }, { blockedAt: "desc" }, { errorAt: "desc" }],
      take: 200,
    }),
    prisma.outboundMessage.findMany({
      where: solicitorProblemWhere(solicitorScope, from, now),
      select: { id: true, transactionId: true, recipientName: true, recipientEmail: true, failedAt: true, failureReason: true, status: true },
      orderBy: { failedAt: "desc" },
      take: 200,
    }),
  ]);

  const byStatus: Record<IssueStatus, number> = { bounced: 0, blocked: 0, deferred: 0, errored: 0, failed: 0 };
  const files = new Set<string>();
  const items: NeedsAttentionItem[] = [];

  // Priority: bounced > blocked > failed > errored > deferred.
  const rank: Record<IssueStatus, number> = { bounced: 0, blocked: 1, failed: 2, errored: 3, deferred: 4 };

  for (const r of queueProblems) {
    let status: IssueStatus;
    let reason: string | null;
    if (r.bouncedAt) { status = "bounced"; reason = r.bouncedReason; }
    else if (r.blockedAt) { status = "blocked"; reason = r.blockedReason; }
    else if (r.errorAt) { status = "errored"; reason = r.errorMessage; }
    else { status = "deferred"; reason = "Repeatedly deferred by the recipient's mail server"; }
    byStatus[status]++;
    const txId = r.recipientContact?.propertyTransactionId ?? "";
    if (txId) files.add(txId);
    items.push({
      emailId: r.id,
      source: "queue",
      status,
      transactionId: txId,
      transactionAddress: txAddressById.get(txId) ?? "(unknown file)",
      recipientName: r.recipientContact?.name ?? "(unknown)",
      recipientEmail: r.recipientEmail,
      recipientRole: r.recipientContact?.roleType ?? "",
      reason,
      deferredCount: r.deferredCount,
      // A bad address is fixable by updating the contact; deferrals/errors are
      // for a human to review (no safe auto-action).
      action: status === "bounced" || status === "blocked" ? "update_contact" : "review",
    });
  }

  for (const m of solProblems) {
    byStatus.failed++;
    const txId = m.transactionId ?? "";
    if (txId) files.add(txId);
    items.push({
      emailId: m.id,
      source: "message",
      status: "failed",
      transactionId: txId,
      transactionAddress: txAddressById.get(txId) ?? "(unknown file)",
      recipientName: m.recipientName ?? "(solicitor)",
      recipientEmail: m.recipientEmail ?? "",
      recipientRole: "solicitor",
      reason: m.failureReason,
      deferredCount: 0,
      action: "review",
    });
  }

  items.sort((a, b) => rank[a.status] - rank[b.status]);
  const total = items.length;

  return {
    total,
    affectedFiles: files.size,
    byStatus,
    items: items.slice(0, ISSUE_ITEM_CAP),
  };
}
