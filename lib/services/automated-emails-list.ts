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
import type { Prisma, ContactRole } from "@prisma/client";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";

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

// Server-side search + filters. Applied to BOTH sources and to the tab counts,
// always ANDed on top of the caller's scope so they can only ever narrow what
// the viewer is already allowed to see — never widen it.
export type EmailFilters = {
  search?: string;                        // address / recipient / email / subject
  category?: "chase" | "notification";    // email type
  recipientRole?: string;                 // vendor / purchaser / solicitor / ...
  deliveryStatus?: EmailDeliveryStatus;   // delivered / bounced / ...
  fromDate?: Date;                        // records created on or after
};

export type EmailListInput = EmailScopeInput & EmailFilters & {
  tab: EmailListTab;
  limit?: number;   // page size; "load more" grows this via the URL. Default 200.
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
  bundleCount?: number;        // milestone digests: N updates delivered as 1 email
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

function categoriseEmailType(emailType: string): "chase" | "notification" {
  return emailType === "CLIENT_CHASE" || emailType === "SOLICITOR_CHASE" ? "chase" : "notification";
}

// ── Queue rows (OutboundEmailQueue) ─────────────────────────────────────────

type QueueRowWithContact = {
  id: string;
  emailType: string;
  recipientContactId: string | null;
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
  bundleCount = 1,
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
    ...(bundleCount > 1 ? { bundleCount } : {}),
  };
}

// Milestone confirmations sent as one digest share (recipientContactId,
// timestamp) — the drain stamps them together. Collapse each such group into a
// single feed row carrying bundleCount, so the feed reflects the ONE email the
// client actually received rather than N pre-digest rows. Non-milestone rows
// pass through untouched.
function mapQueueRowsCollapsed(
  rows: QueueRowWithContact[],
  status: "pending" | "sent" | "errored",
  ts: (r: QueueRowWithContact) => Date | null,
  txAddressById: Map<string, string>,
): EmailRow[] {
  const out: EmailRow[] = [];
  const groupIdx = new Map<string, number>();
  for (const r of rows) {
    const stamp = ts(r);
    if (r.emailType === "MILESTONE_CONFIRMATION" && r.recipientContactId && stamp) {
      const key = `${r.recipientContactId}|${stamp.getTime()}`;
      const at = groupIdx.get(key);
      if (at !== undefined) {
        const row = out[at];
        row.bundleCount = (row.bundleCount ?? 1) + 1;
        continue;
      }
      groupIdx.set(key, out.length);
    }
    out.push(mapQueueRow(r, status, txAddressById));
  }
  return out;
}

const queueRowSelect = {
  id: true,
  emailType: true,
  recipientContactId: true,
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

// ── Filter translation ──────────────────────────────────────────────────────

const contains = (s: string): Prisma.StringFilter => ({ contains: s, mode: "insensitive" });

// Map a fine-grained delivery status to a queue timestamp predicate.
function queueStatusWhere(status: EmailDeliveryStatus): Prisma.OutboundEmailQueueWhereInput {
  switch (status) {
    case "pending":   return { sentAt: null, errorAt: null };
    case "delivered": return { deliveredAt: { not: null } };
    case "deferred":  return { deferredAt: { not: null }, deliveredAt: null };
    case "bounced":   return { bouncedAt: { not: null } };
    case "blocked":   return { blockedAt: { not: null } };
    case "errored":
    case "failed":    return { errorAt: { not: null } };
    case "sent":      return { sentAt: { not: null }, deliveredAt: null, deferredAt: null, bouncedAt: null, blockedAt: null, errorAt: null };
  }
}

// Map a delivery status to a solicitor (OutboundMessage) predicate, or null
// when the status can't apply to a solicitor send (so the source is excluded).
function messageStatusWhere(status: EmailDeliveryStatus): Prisma.OutboundMessageWhereInput | null {
  switch (status) {
    case "delivered": return { OR: [{ status: { in: ["delivered", "opened", "clicked"] } }, { deliveredAt: { not: null } }] };
    case "bounced":   return { status: "bounced" };
    case "errored":
    case "failed":    return { OR: [{ status: "failed" }, { failedAt: { not: null } }] };
    case "sent":      return { status: "sent" };
    case "pending":
    case "deferred":
    case "blocked":   return null; // solicitor sends have no such state
  }
}

// AND-able filter clause for the queue. Excludes nothing on its own.
function buildQueueFilter(f: EmailFilters): Prisma.OutboundEmailQueueWhereInput {
  const and: Prisma.OutboundEmailQueueWhereInput[] = [];
  if (f.search) {
    const s = f.search.trim();
    and.push({
      OR: [
        { recipientEmail: contains(s) },
        { recipientContact: { name: contains(s) } },
        { recipientContact: { transaction: { propertyAddress: contains(s) } } },
        { payload: { path: ["subject"], string_contains: s } },
      ],
    });
  }
  if (f.category === "chase") and.push({ emailType: "CLIENT_CHASE" });
  if (f.category === "notification") and.push({ emailType: { not: "CLIENT_CHASE" } });
  if (f.recipientRole) and.push({ recipientContact: { roleType: f.recipientRole as ContactRole } });
  if (f.deliveryStatus) and.push(queueStatusWhere(f.deliveryStatus));
  if (f.fromDate) and.push({ createdAt: { gte: f.fromDate } });
  return and.length ? { AND: and } : {};
}

// AND-able filter clause for solicitor sends, or null to exclude the source
// entirely (e.g. filtering to notifications, or a non-solicitor recipient role).
function buildSolicitorFilter(f: EmailFilters): Prisma.OutboundMessageWhereInput | null {
  if (f.category === "notification") return null;
  if (f.recipientRole && f.recipientRole !== "solicitor") return null;
  const and: Prisma.OutboundMessageWhereInput[] = [];
  if (f.search) {
    const s = f.search.trim();
    and.push({
      OR: [
        { recipientEmail: contains(s) },
        { recipientName: contains(s) },
        { subject: contains(s) },
        { transaction: { propertyAddress: contains(s) } },
      ],
    });
  }
  if (f.deliveryStatus) {
    const w = messageStatusWhere(f.deliveryStatus);
    if (!w) return null; // status not representable for solicitor sends
    and.push(w);
  }
  if (f.fromDate) and.push({ createdAt: { gte: f.fromDate } });
  return and.length ? { AND: and } : {};
}

export async function listAutomatedEmails(input: EmailListInput): Promise<EmailListResponse> {
  // Single scope resolution feeds both sources (queue + solicitor messages).
  const { txIds, txAddressById, queueScope, solicitorScope } = await resolveEmailScope(input);

  const pageSize = Math.min(Math.max(input.limit ?? PAGE_SIZE, PAGE_SIZE), 2000);

  // Search + filters, ANDed on top of scope (narrow-only). sFilter === null
  // means the current filters exclude solicitor sends entirely.
  const qFilter = buildQueueFilter(input);
  const sFilter = buildSolicitorFilter(input);
  const qWhere = (pred: Prisma.OutboundEmailQueueWhereInput): Prisma.OutboundEmailQueueWhereInput =>
    ({ AND: [queueScope, qFilter, pred] });
  const sWhere = (pred: Prisma.OutboundMessageWhereInput): Prisma.OutboundMessageWhereInput | null =>
    (sFilter === null ? null : { AND: [solicitorScope, sFilter, pred] });

  // Empty-scope short-circuit. Avoids the count fan-out with `in: []`.
  if (txIds.length === 0) {
    return { rows: [], counts: { pending: 0, sentLast7d: 0, sentLast30d: 0, errored: 0 }, hasMore: false };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // A solicitor row is an "issue" when the send failed or bounced.
  const solErroredPred: Prisma.OutboundMessageWhereInput = {
    OR: [{ status: { in: ["failed", "bounced"] } }, { failedAt: { not: null } }],
  };
  const solSent7dWhere = sWhere({ sentAt: { gte: sevenDaysAgo } });
  const solSent30dWhere = sWhere({ sentAt: { gte: thirtyDaysAgo } });
  const solErroredWhere = sWhere(solErroredPred);

  // "Errored" means a GENUINE send failure. Exclude the two non-failures that
  // also stamp errorAt: dead-round skips (the system correctly refusing to
  // email a fell-through buyer) and manual cancellations. Neither is an issue.
  const genuineFailurePred: Prisma.OutboundEmailQueueWhereInput = {
    errorAt: { not: null },
    NOT: { OR: [{ errorMessage: { in: ["recipient_round_archived"] } }, { errorMessage: { startsWith: "Cancelled" } }] },
  };

  // Sent-email count that treats a milestone digest (N confirmations delivered
  // to one recipient in one send) as ONE email, matching what the client got.
  const sentEmailCount = async (since: Date): Promise<number> => {
    const [nonMilestone, digests] = await Promise.all([
      prisma.outboundEmailQueue.count({ where: qWhere({ emailType: { not: "MILESTONE_CONFIRMATION" }, sentAt: { gte: since } }) }),
      prisma.outboundEmailQueue.groupBy({
        by: ["recipientContactId", "sentAt"],
        where: { AND: [queueScope, qFilter, { emailType: "MILESTONE_CONFIRMATION", sentAt: { gte: since } }] },
      }),
    ]);
    return nonMilestone + digests.length;
  };

  // KPI + tab-label counts across BOTH sources, in parallel. Pending is
  // queue-only (solicitor chases send synchronously). A null solicitor where
  // means the active filters exclude solicitor sends → that count is 0.
  const [qPending, qSent7d, qSent30d, qErrored, sSent7d, sSent30d, sErrored] = await Promise.all([
    prisma.outboundEmailQueue.count({ where: qWhere({ sentAt: null, errorAt: null }) }),
    sentEmailCount(sevenDaysAgo),
    sentEmailCount(thirtyDaysAgo),
    prisma.outboundEmailQueue.count({ where: qWhere(genuineFailurePred) }),
    solSent7dWhere ? prisma.outboundMessage.count({ where: solSent7dWhere }) : 0,
    solSent30dWhere ? prisma.outboundMessage.count({ where: solSent30dWhere }) : 0,
    solErroredWhere ? prisma.outboundMessage.count({ where: solErroredWhere }) : 0,
  ]);
  const counts = {
    pending: qPending,
    sentLast7d: qSent7d + sSent7d,
    sentLast30d: qSent30d + sSent30d,
    errored: qErrored + sErrored,
  };

  // Tab-specific row fetch (filters ANDed via qWhere/sWhere). Queue rows are
  // digest-collapsed so milestone bundles show as one row.
  let rows: EmailRow[] = [];
  let hasMore = false;

  if (input.tab === "pending") {
    const queueRows = await prisma.outboundEmailQueue.findMany({
      where: qWhere({ sentAt: null, errorAt: null }),
      select: queueRowSelect,
      orderBy: { scheduledFor: "asc" },
      take: pageSize + 1,
    });
    const collapsed = mapQueueRowsCollapsed(queueRows, "pending", (r) => r.scheduledFor, txAddressById);
    hasMore = collapsed.length > pageSize;
    rows = collapsed.slice(0, pageSize);
  } else if (input.tab === "sent") {
    const sentSol = sWhere({ sentAt: { gte: thirtyDaysAgo } });
    const [queueRows, messageRows] = await Promise.all([
      prisma.outboundEmailQueue.findMany({
        where: qWhere({ sentAt: { gte: thirtyDaysAgo } }),
        select: queueRowSelect, orderBy: { sentAt: "desc" }, take: pageSize + 1,
      }),
      sentSol ? prisma.outboundMessage.findMany({ where: sentSol, select: messageRowSelect, orderBy: { sentAt: "desc" }, take: pageSize + 1 }) : [],
    ]);
    const merged = [
      ...mapQueueRowsCollapsed(queueRows, "sent", (r) => r.sentAt, txAddressById),
      ...messageRows.map((m) => mapMessageRow(m, "sent", txAddressById)),
    ].sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
    hasMore = merged.length > pageSize;
    rows = merged.slice(0, pageSize);
  } else if (input.tab === "errored") {
    const errSol = sWhere(solErroredPred);
    const [queueRows, messageRows] = await Promise.all([
      prisma.outboundEmailQueue.findMany({
        where: qWhere(genuineFailurePred),
        select: queueRowSelect, orderBy: { errorAt: "desc" }, take: pageSize + 1,
      }),
      errSol ? prisma.outboundMessage.findMany({ where: errSol, select: messageRowSelect, orderBy: { sentAt: "desc" }, take: pageSize + 1 }) : [],
    ]);
    const merged = [
      ...mapQueueRowsCollapsed(queueRows, "errored", (r) => r.errorAt, txAddressById),
      ...messageRows.map((m) => mapMessageRow(m, "errored", txAddressById)),
    ].sort((a, b) => (b.errorAt?.getTime() ?? 0) - (a.errorAt?.getTime() ?? 0));
    hasMore = merged.length > pageSize;
    rows = merged.slice(0, pageSize);
  } else {
    rows = await buildUpcomingRows(txIds, txAddressById, input);
  }

  return { rows, counts, hasMore };
}

// Upcoming = predictions (client chases only in this feed; solicitor prediction
// + "automation exhausted" arrive in PR 5). Filters are applied in memory —
// predictions are synthetic, not DB rows.
async function buildUpcomingRows(
  txIds: string[],
  txAddressById: Map<string, string>,
  f: EmailFilters,
): Promise<EmailRow[]> {
  // Predictions are pending client chases; any incompatible filter short-circuits.
  if (f.category === "notification") return [];
  if (f.deliveryStatus && f.deliveryStatus !== "pending") return [];
  if (f.recipientRole && f.recipientRole !== "vendor" && f.recipientRole !== "purchaser") return [];

  const previews = await Promise.all(
    txIds.map((id) =>
      getAutomatedEmailsForTransaction(id).catch(() => ({
        pending: [], sentToday: [], upcoming: [],
        pauseState: { globalDisabled: false, agencyDisabled: false, fileDisabled: false, activePauseReason: null, agencyName: null },
      })),
    ),
  );
  const search = f.search?.trim().toLowerCase();
  const rows = previews.flatMap((preview, idx) => {
    const txId = txIds[idx];
    const address = txAddressById.get(txId) ?? "(unknown file)";
    return preview.upcoming
      .filter((u) => !f.recipientRole || u.contactRole === f.recipientRole)
      .filter((u) => {
        if (!search) return true;
        return (
          address.toLowerCase().includes(search) ||
          u.contactName.toLowerCase().includes(search) ||
          u.milestoneLabel.toLowerCase().includes(search)
        );
      })
      .map((u): EmailRow => ({
        id: `upcoming-${txId}-${u.contactId}-${u.milestoneCode}`,
        source: "queue",
        emailType: "CLIENT_CHASE",
        category: "chase",
        transactionId: txId,
        transactionAddress: address,
        recipientName: u.contactName,
        recipientRole: u.contactRole,
        subject: `${u.milestoneLabel} chase`,
        status: "upcoming",
        deliveryStatus: "pending",
        scheduledFor: u.predictedFireDate,
        sentAt: null,
        errorAt: null,
        errorMessage: null,
        chaseNumber: u.chaseNumber,
      }));
  });
  rows.sort((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0));
  return rows;
}
