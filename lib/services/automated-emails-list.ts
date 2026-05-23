// Platform-wide automated emails listing service.
//
// Powers /agent/automated-emails — flattens OutboundEmailQueue rows across
// every transaction in the caller's scope into a single feed, with KPI
// counts and four tab views: pending now, sent last 30 days, errored,
// upcoming (predicted next 14 days).
//
// Scope handling:
//   - admin / superadmin → see all transactions platform-wide
//   - sales_progressor   → only their assigned files
//   - negotiator         → only files where they're the agentUser
//   - director           → all agency files by default, narrow to own files
//                          via mineOnly flag (segment-pill toggle in UI)
//
// v1 covers OutboundEmailQueue rows only (CLIENT_CHASE / EXCHANGE /
// COMPLETION / CELEBRATION / MEDIANS_READY). ChainNotificationQueue
// (LOST_BUYER / LOST_PURCHASE / ASKED_TO_WAIT) has a different mechanic
// and gets its own surface later if needed.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";

export type EmailListTab = "pending" | "sent" | "errored" | "upcoming";

export type EmailListInput = {
  // Resolved from the session — caller is responsible for passing the right
  // values from session.user.
  role: "director" | "negotiator" | "sales_progressor" | "admin" | "superadmin" | "viewer";
  userId: string;
  agencyId: string | null;
  mineOnly?: boolean;       // director's "my files only" toggle
  fileId?: string;          // when present, list filtered to one transaction
  tab: EmailListTab;
};

export type EmailRow = {
  id: string;
  emailType: string;
  category: "chase" | "notification";
  transactionId: string;
  transactionAddress: string;
  recipientName: string;
  recipientRole: string;       // "vendor" | "purchaser" etc
  subject: string;
  status: "pending" | "sent" | "errored" | "upcoming";
  scheduledFor: Date | null;
  sentAt: Date | null;
  errorAt: Date | null;
  errorMessage: string | null;
  chaseNumber?: number;        // upcoming only — "chase X of 2"
};

export type EmailListResponse = {
  rows: EmailRow[];
  counts: { pending: number; sentLast7d: number; errored: number };
};

// Build the transaction-where clause from caller role + scope. Independent
// of access-scope.ts because we need additional role-specific narrowing
// (negotiator → assigned to self; director → optional mineOnly).
function buildTxWhere(input: EmailListInput): Prisma.PropertyTransactionWhereInput {
  const where: Prisma.PropertyTransactionWhereInput = {};

  if (input.role === "admin" || input.role === "superadmin") {
    // No agency filter — admin sees the whole platform.
  } else if (input.role === "sales_progressor") {
    where.assignedUserId = input.userId;
  } else if (input.role === "negotiator" || input.role === "viewer") {
    where.agencyId = input.agencyId ?? "__none__";
    where.agentUserId = input.userId;
  } else if (input.role === "director") {
    where.agencyId = input.agencyId ?? "__none__";
    if (input.mineOnly) where.agentUserId = input.userId;
  }

  if (input.fileId) where.id = input.fileId;

  return where;
}

function categoriseEmailType(emailType: string): "chase" | "notification" {
  return emailType === "CLIENT_CHASE" ? "chase" : "notification";
}

type QueueRowWithContact = {
  id: string;
  emailType: string;
  scheduledFor: Date;
  sentAt: Date | null;
  errorAt: Date | null;
  errorMessage: string | null;
  payload: Prisma.JsonValue;
  recipientContact: {
    name: string;
    roleType: string;
    propertyTransactionId: string;
  } | null;
};

function mapQueueRow(
  r: QueueRowWithContact,
  status: "pending" | "sent" | "errored",
  txAddressById: Map<string, string>,
): EmailRow {
  const payload = (r.payload ?? {}) as { subject?: string };
  const txId = r.recipientContact?.propertyTransactionId ?? "";
  return {
    id: r.id,
    emailType: r.emailType,
    category: categoriseEmailType(r.emailType),
    transactionId: txId,
    transactionAddress: txAddressById.get(txId) ?? "(unknown file)",
    recipientName: r.recipientContact?.name ?? "(unknown)",
    recipientRole: r.recipientContact?.roleType ?? "",
    subject: payload.subject ?? "(no subject)",
    status,
    scheduledFor: r.scheduledFor,
    sentAt: r.sentAt,
    errorAt: r.errorAt,
    errorMessage: r.errorMessage,
  };
}

export async function listAutomatedEmails(input: EmailListInput): Promise<EmailListResponse> {
  const txWhere = buildTxWhere(input);

  // Resolve the in-scope transactions once. Used for both the count queries
  // (via subquery on Contact.propertyTransactionId) and for the address
  // map used to render each row.
  const transactions = await prisma.propertyTransaction.findMany({
    where: txWhere,
    select: { id: true, propertyAddress: true },
  });
  const txIds = transactions.map((t) => t.id);
  const txAddressById = new Map(transactions.map((t) => [t.id, t.propertyAddress]));

  // Empty-scope short-circuit. Avoids 5 queries with `in: []`.
  if (txIds.length === 0) {
    return { rows: [], counts: { pending: 0, sentLast7d: 0, errored: 0 } };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // KPI counts always shown regardless of tab. Three parallel COUNTs.
  const baseScopeFilter = {
    recipientContact: { propertyTransactionId: { in: txIds } },
  };
  const [pendingCount, sent7dCount, erroredCount] = await Promise.all([
    prisma.outboundEmailQueue.count({
      where: { ...baseScopeFilter, sentAt: null, errorAt: null },
    }),
    prisma.outboundEmailQueue.count({
      where: { ...baseScopeFilter, sentAt: { gte: sevenDaysAgo } },
    }),
    prisma.outboundEmailQueue.count({
      where: { ...baseScopeFilter, errorAt: { not: null } },
    }),
  ]);
  const counts = { pending: pendingCount, sentLast7d: sent7dCount, errored: erroredCount };

  // Tab-specific row fetch.
  let rows: EmailRow[] = [];

  if (input.tab === "pending") {
    const queueRows = await prisma.outboundEmailQueue.findMany({
      where: { ...baseScopeFilter, sentAt: null, errorAt: null },
      include: {
        recipientContact: { select: { name: true, roleType: true, propertyTransactionId: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: 500,
    });
    rows = queueRows.map((r) => mapQueueRow(r as QueueRowWithContact, "pending", txAddressById));
  } else if (input.tab === "sent") {
    const queueRows = await prisma.outboundEmailQueue.findMany({
      where: { ...baseScopeFilter, sentAt: { gte: thirtyDaysAgo } },
      include: {
        recipientContact: { select: { name: true, roleType: true, propertyTransactionId: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 500,
    });
    rows = queueRows.map((r) => mapQueueRow(r as QueueRowWithContact, "sent", txAddressById));
  } else if (input.tab === "errored") {
    const queueRows = await prisma.outboundEmailQueue.findMany({
      where: { ...baseScopeFilter, errorAt: { not: null } },
      include: {
        recipientContact: { select: { name: true, roleType: true, propertyTransactionId: true } },
      },
      orderBy: { errorAt: "desc" },
      take: 500,
    });
    rows = queueRows.map((r) => mapQueueRow(r as QueueRowWithContact, "errored", txAddressById));
  } else {
    // Upcoming: predictions from per-file logic flattened. Caps in the
    // preview module already bound the per-tx row count to a 14-day window.
    // Pre-launch ~25 in-scope tx max so the per-tx call fan-out is fine.
    const previews = await Promise.all(
      txIds.map((id) =>
        getAutomatedEmailsForTransaction(id).catch(() => ({ pending: [], sentToday: [], upcoming: [] })),
      ),
    );
    rows = previews.flatMap((preview, idx) => {
      const txId = txIds[idx];
      const address = txAddressById.get(txId) ?? "(unknown file)";
      return preview.upcoming.map((u) => ({
        id: `upcoming-${txId}-${u.contactId}-${u.milestoneCode}`,
        emailType: "CLIENT_CHASE",
        category: "chase" as const,
        transactionId: txId,
        transactionAddress: address,
        recipientName: u.contactName,
        recipientRole: u.contactRole,
        subject: `${u.milestoneLabel} chase`,
        status: "upcoming" as const,
        scheduledFor: u.predictedFireDate,
        sentAt: null,
        errorAt: null,
        errorMessage: null,
        chaseNumber: u.chaseNumber,
      }));
    });
    rows.sort(
      (a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
    );
  }

  return { rows, counts };
}
