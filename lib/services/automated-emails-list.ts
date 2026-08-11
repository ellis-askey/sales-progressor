// Platform-wide automated emails listing service.
//
// Powers /agent/automated-emails — flattens automated email records across
// every transaction in the caller's scope into a single feed, with KPI
// counts and four tab views: pending now, sent last 30 days, errored,
// upcoming (predicted next 14 days).
//
// Two sources, unified here (2026-08-11, PR 1):
//   1. OutboundEmailQueue — client chases (CLIENT_CHASE) plus milestone /
//      exchange / completion / celebration mail. One row is both "queued"
//      and "sent" (distinguished by sentAt); delivery truth lives in the
//      deliveredAt / deferredAt / bouncedAt / blockedAt / errorAt columns
//      written back by the SendGrid webhook.
//   2. OutboundMessage — SOLICITOR chases. These send directly (they never
//      pass through the queue) and are logged here with purpose="chase",
//      isAutomated=true, createdByRole="director" (the solicitor-chase mirror
//      writes exactly that). Two other automated chase shapes live in this
//      table and must be excluded: the queue drain's CLIENT-chase mirrors
//      (createdByRole="system") and historical/imported chase rows
//      (createdByRole=null, no subject). Verified against prod 2026-08-11:
//      464 system mirrors, 1291 null historical, 0 director rows today — the
//      seam is real and will populate as solicitor chase runs.
//      Known limitation: the mirror only writes when the file has an assigned
//      agent (agentId), so agent-less solicitor sends aren't captured here.
//      That's a pre-existing gap in the send pipeline (off-limits for PR 1).
//
// Scope handling (single resolver — buildTxWhere → txIds feeds BOTH sources):
//   - admin / superadmin → see all transactions platform-wide
//   - sales_progressor   → only their assigned files
//   - negotiator         → only files where they're the agentUser (self-managed)
//   - director           → all agency self-managed files by default, narrow to
//                          own files via mineOnly (segment-pill toggle in UI)
//
// ChainNotificationQueue (LOST_BUYER / ASKED_TO_WAIT / …) has a different
// mechanic and stays on its own surface — not part of this feed.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";

export type EmailListTab = "pending" | "sent" | "errored" | "upcoming";

// Fine-grained delivery state, derived from the timestamp columns (queue) or
// the status enum + timestamps (message). Distinct from the tab bucket in
// `status` — a "sent"-tab row can be delivered, deferred, bounced, etc.
export type EmailDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "deferred"
  | "bounced"
  | "blocked"
  | "errored"
  | "failed";

export type EmailListInput = {
  // Resolved from the session — caller is responsible for passing the right
  // values from session.user.
  role: "director" | "negotiator" | "sales_progressor" | "admin" | "superadmin" | "viewer";
  userId: string;
  agencyId: string | null;
  // True for admin/superadmin AND for the hybrid sales_progressor exception
  // (ellis). Lets a hybrid SP see the platform-wide list while keeping role=SP.
  hasAdminPowers?: boolean;
  mineOnly?: boolean;       // director's "my files only" toggle
  fileId?: string;          // when present, list filtered to one transaction
  tab: EmailListTab;
};

export type EmailRow = {
  id: string;
  source: "queue" | "message";  // which table it came from (drives detail routing)
  emailType: string;
  category: "chase" | "notification";
  transactionId: string;
  transactionAddress: string;
  recipientName: string;
  recipientRole: string;       // "vendor" | "purchaser" | "solicitor" etc
  subject: string;
  status: "pending" | "sent" | "errored" | "upcoming";  // tab bucket
  deliveryStatus: EmailDeliveryStatus;                  // fine-grained state
  scheduledFor: Date | null;
  sentAt: Date | null;
  errorAt: Date | null;
  errorMessage: string | null;
  chaseNumber?: number;        // upcoming only — "chase X of 2"
};

export type EmailListResponse = {
  rows: EmailRow[];
  counts: {
    pending: number;
    sentLast7d: number;   // KPI strip — "what happened lately"
    sentLast30d: number;  // Sent-tab label — matches the tab's 30-day window
    errored: number;
  };
  // True when the current tab has more rows than the page returned. The row
  // UI ("load more") lands in PR 3; the service returns the signal now.
  hasMore: boolean;
};

// One page of the feed. Pre-launch volumes are small; PR 3 introduces proper
// cursor pagination + a "load more" control that consumes `hasMore`.
const PAGE_SIZE = 200;

// Build the transaction-where clause from caller role + scope. This stays the
// single scope resolver for the whole feed (both sources scope off the txIds
// it yields). It intentionally narrows MORE than access-scope.ts's
// scopeTransactionWhere (self-managed only; negotiator → own files), so it is
// deliberately not replaced by that helper — see the PR 1 note in the report.
function buildTxWhere(input: EmailListInput): Prisma.PropertyTransactionWhereInput {
  const where: Prisma.PropertyTransactionWhereInput = {};

  if (input.hasAdminPowers) {
    // No agency filter — admin (and hybrid SP) sees the whole platform.
  } else if (input.role === "sales_progressor") {
    where.assignedUserId = input.userId;
  } else if (input.role === "negotiator" || input.role === "viewer") {
    where.agencyId = input.agencyId ?? "__none__";
    where.agentUserId = input.userId;
    // Founder rule 2026-08-09: agencies only see automated emails for the
    // files they progress themselves. Outsourced files' client emails are
    // handled by the SP team, so they don't belong on the agency's page.
    where.serviceType = "self_managed";
  } else if (input.role === "director") {
    where.agencyId = input.agencyId ?? "__none__";
    where.serviceType = "self_managed";
    if (input.mineOnly) where.agentUserId = input.userId;
  }

  if (input.fileId) where.id = input.fileId;

  return where;
}

function categoriseEmailType(emailType: string): "chase" | "notification" {
  return emailType === "CLIENT_CHASE" || emailType === "SOLICITOR_CHASE" ? "chase" : "notification";
}

// ── Queue rows (OutboundEmailQueue) ─────────────────────────────────────────

type QueueRowWithContact = {
  id: string;
  emailType: string;
  scheduledFor: Date;
  sentAt: Date | null;
  errorAt: Date | null;
  errorMessage: string | null;
  deliveredAt: Date | null;
  deferredAt: Date | null;
  bouncedAt: Date | null;
  blockedAt: Date | null;
  payload: Prisma.JsonValue;
  recipientContact: {
    name: string;
    roleType: string;
    propertyTransactionId: string;
  } | null;
};

// Derive the fine-grained delivery state from the queue's timestamp columns.
// Order matters: terminal problems (error/bounce/block) win over softer
// signals (deferred), and any of those win over a plain "delivered"/"sent".
function deriveQueueDeliveryStatus(r: QueueRowWithContact): EmailDeliveryStatus {
  if (r.errorAt) return "errored";
  if (!r.sentAt) return "pending";
  if (r.bouncedAt) return "bounced";
  if (r.blockedAt) return "blocked";
  if (r.deferredAt && !r.deliveredAt) return "deferred";
  if (r.deliveredAt) return "delivered";
  return "sent";
}

function mapQueueRow(
  r: QueueRowWithContact,
  status: "pending" | "sent" | "errored",
  txAddressById: Map<string, string>,
): EmailRow {
  const payload = (r.payload ?? {}) as { subject?: string };
  const txId = r.recipientContact?.propertyTransactionId ?? "";
  return {
    id: r.id,
    source: "queue",
    emailType: r.emailType,
    category: categoriseEmailType(r.emailType),
    transactionId: txId,
    transactionAddress: txAddressById.get(txId) ?? "(unknown file)",
    recipientName: r.recipientContact?.name ?? "(unknown)",
    recipientRole: r.recipientContact?.roleType ?? "",
    subject: payload.subject ?? "(no subject)",
    status,
    deliveryStatus: deriveQueueDeliveryStatus(r),
    scheduledFor: r.scheduledFor,
    sentAt: r.sentAt,
    errorAt: r.errorAt,
    errorMessage: r.errorMessage,
  };
}

const queueRowSelect = {
  id: true,
  emailType: true,
  scheduledFor: true,
  sentAt: true,
  errorAt: true,
  errorMessage: true,
  deliveredAt: true,
  deferredAt: true,
  bouncedAt: true,
  blockedAt: true,
  payload: true,
  recipientContact: { select: { name: true, roleType: true, propertyTransactionId: true } },
} satisfies Prisma.OutboundEmailQueueSelect;

// ── Solicitor rows (OutboundMessage) ────────────────────────────────────────

type MessageRow = {
  id: string;
  transactionId: string | null;
  subject: string | null;
  recipientName: string | null;
  status: string;
  sentAt: Date | null;
  scheduledFor: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
};

const messageRowSelect = {
  id: true,
  transactionId: true,
  subject: true,
  recipientName: true,
  status: true,
  sentAt: true,
  scheduledFor: true,
  deliveredAt: true,
  failedAt: true,
  failureReason: true,
} satisfies Prisma.OutboundMessageSelect;

function deriveMessageDeliveryStatus(m: MessageRow): EmailDeliveryStatus {
  if (m.status === "failed" || m.failedAt) return "failed";
  if (m.status === "bounced") return "bounced";
  if (m.status === "delivered" || m.status === "opened" || m.status === "clicked" || m.deliveredAt) return "delivered";
  return "sent";
}

function mapMessageRow(
  m: MessageRow,
  status: "sent" | "errored",
  txAddressById: Map<string, string>,
): EmailRow {
  const txId = m.transactionId ?? "";
  return {
    id: m.id,
    source: "message",
    emailType: "SOLICITOR_CHASE",
    category: "chase",
    transactionId: txId,
    transactionAddress: txAddressById.get(txId) ?? "(unknown file)",
    recipientName: m.recipientName ?? "(solicitor)",
    recipientRole: "solicitor",
    subject: m.subject ?? "(no subject)",
    status,
    deliveryStatus: deriveMessageDeliveryStatus(m),
    scheduledFor: m.scheduledFor,
    sentAt: m.sentAt,
    errorAt: m.failedAt,
    errorMessage: m.failureReason,
  };
}

// Solicitor automated sends only. createdByRole="director" is the solicitor-
// chase mirror's signature — it isolates those from the drain's client-chase
// mirrors ("system") and historical imported chase rows (null).
function solicitorMessageWhere(txIds: string[]): Prisma.OutboundMessageWhereInput {
  return {
    transactionId: { in: txIds },
    channel: "email",
    purpose: "chase",
    isAutomated: true,
    createdByRole: "director",
  };
}

export async function listAutomatedEmails(input: EmailListInput): Promise<EmailListResponse> {
  const txWhere = buildTxWhere(input);

  // Resolve the in-scope transactions once. Both sources scope off these ids:
  // the queue via its recipientContact relation, OutboundMessage via its own
  // transactionId column. activeBuyerRoundId lets us hide queue rows aimed at a
  // fall-through buyer's Contact (a previous sale) from the live surface.
  const transactions = await prisma.propertyTransaction.findMany({
    where: txWhere,
    select: { id: true, propertyAddress: true, activeBuyerRoundId: true },
  });
  const txIds = transactions.map((t) => t.id);
  const txAddressById = new Map(transactions.map((t) => [t.id, t.propertyAddress]));
  const activeRoundIds = transactions
    .map((t) => t.activeBuyerRoundId)
    .filter((id): id is string => id !== null);

  // Empty-scope short-circuit. Avoids the count fan-out with `in: []`.
  if (txIds.length === 0) {
    return { rows: [], counts: { pending: 0, sentLast7d: 0, sentLast30d: 0, errored: 0 }, hasMore: false };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Round-aware contact filter for the queue (purchaser contacts from a
  // fall-through round are hidden; vendor/solicitor/broker are file-level).
  const queueScope: Prisma.OutboundEmailQueueWhereInput = {
    recipientContact: {
      propertyTransactionId: { in: txIds },
      OR: [
        { roleType: { not: "purchaser" as const } },
        { buyerRoundId: null },
        { buyerRoundId: { in: activeRoundIds } },
      ],
    },
  };
  const solicitorScope = solicitorMessageWhere(txIds);
  // A solicitor row is an "issue" when the send failed or bounced.
  const solicitorErroredScope: Prisma.OutboundMessageWhereInput = {
    ...solicitorScope,
    OR: [{ status: { in: ["failed", "bounced"] } }, { failedAt: { not: null } }],
  };

  // KPI + tab-label counts across BOTH sources, in parallel. Pending is
  // queue-only (solicitor chases send synchronously — they're never pending).
  const [
    qPending,
    qSent7d,
    qSent30d,
    qErrored,
    sSent7d,
    sSent30d,
    sErrored,
  ] = await Promise.all([
    prisma.outboundEmailQueue.count({ where: { ...queueScope, sentAt: null, errorAt: null } }),
    prisma.outboundEmailQueue.count({ where: { ...queueScope, sentAt: { gte: sevenDaysAgo } } }),
    prisma.outboundEmailQueue.count({ where: { ...queueScope, sentAt: { gte: thirtyDaysAgo } } }),
    prisma.outboundEmailQueue.count({ where: { ...queueScope, errorAt: { not: null } } }),
    prisma.outboundMessage.count({ where: { ...solicitorScope, sentAt: { gte: sevenDaysAgo } } }),
    prisma.outboundMessage.count({ where: { ...solicitorScope, sentAt: { gte: thirtyDaysAgo } } }),
    prisma.outboundMessage.count({ where: solicitorErroredScope }),
  ]);
  const counts = {
    pending: qPending,
    sentLast7d: qSent7d + sSent7d,
    sentLast30d: qSent30d + sSent30d,
    errored: qErrored + sErrored,
  };

  // Tab-specific row fetch.
  let rows: EmailRow[] = [];
  let hasMore = false;

  if (input.tab === "pending") {
    const queueRows = await prisma.outboundEmailQueue.findMany({
      where: { ...queueScope, sentAt: null, errorAt: null },
      select: queueRowSelect,
      orderBy: { scheduledFor: "asc" },
      take: PAGE_SIZE + 1,
    });
    hasMore = queueRows.length > PAGE_SIZE;
    rows = queueRows.slice(0, PAGE_SIZE).map((r) => mapQueueRow(r, "pending", txAddressById));
  } else if (input.tab === "sent") {
    const [queueRows, messageRows] = await Promise.all([
      prisma.outboundEmailQueue.findMany({
        where: { ...queueScope, sentAt: { gte: thirtyDaysAgo } },
        select: queueRowSelect,
        orderBy: { sentAt: "desc" },
        take: PAGE_SIZE + 1,
      }),
      prisma.outboundMessage.findMany({
        where: { ...solicitorScope, sentAt: { gte: thirtyDaysAgo } },
        select: messageRowSelect,
        orderBy: { sentAt: "desc" },
        take: PAGE_SIZE + 1,
      }),
    ]);
    const merged = [
      ...queueRows.map((r) => mapQueueRow(r, "sent", txAddressById)),
      ...messageRows.map((m) => mapMessageRow(m, "sent", txAddressById)),
    ].sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
    hasMore = merged.length > PAGE_SIZE;
    rows = merged.slice(0, PAGE_SIZE);
  } else if (input.tab === "errored") {
    const [queueRows, messageRows] = await Promise.all([
      prisma.outboundEmailQueue.findMany({
        where: { ...queueScope, errorAt: { not: null } },
        select: queueRowSelect,
        orderBy: { errorAt: "desc" },
        take: PAGE_SIZE + 1,
      }),
      prisma.outboundMessage.findMany({
        where: solicitorErroredScope,
        select: messageRowSelect,
        orderBy: { sentAt: "desc" },
        take: PAGE_SIZE + 1,
      }),
    ]);
    const merged = [
      ...queueRows.map((r) => mapQueueRow(r, "errored", txAddressById)),
      ...messageRows.map((m) => mapMessageRow(m, "errored", txAddressById)),
    ].sort((a, b) => (b.errorAt?.getTime() ?? 0) - (a.errorAt?.getTime() ?? 0));
    hasMore = merged.length > PAGE_SIZE;
    rows = merged.slice(0, PAGE_SIZE);
  } else {
    // Upcoming: predictions from per-file logic flattened. Caps in the preview
    // module bound each tx to a 14-day window. Solicitor-chase prediction and
    // the "automation exhausted" signal land in PR 5; this stays client-only.
    const previews = await Promise.all(
      txIds.map((id) =>
        getAutomatedEmailsForTransaction(id).catch(() => ({
          pending: [],
          sentToday: [],
          upcoming: [],
          pauseState: { globalDisabled: false, agencyDisabled: false, fileDisabled: false, activePauseReason: null, agencyName: null },
        })),
      ),
    );
    rows = previews.flatMap((preview, idx) => {
      const txId = txIds[idx];
      const address = txAddressById.get(txId) ?? "(unknown file)";
      return preview.upcoming.map((u) => ({
        id: `upcoming-${txId}-${u.contactId}-${u.milestoneCode}`,
        source: "queue" as const,
        emailType: "CLIENT_CHASE",
        category: "chase" as const,
        transactionId: txId,
        transactionAddress: address,
        recipientName: u.contactName,
        recipientRole: u.contactRole,
        subject: `${u.milestoneLabel} chase`,
        status: "upcoming" as const,
        deliveryStatus: "pending" as const,
        scheduledFor: u.predictedFireDate,
        sentAt: null,
        errorAt: null,
        errorMessage: null,
        chaseNumber: u.chaseNumber,
      }));
    });
    rows.sort((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0));
  }

  return { rows, counts, hasMore };
}
