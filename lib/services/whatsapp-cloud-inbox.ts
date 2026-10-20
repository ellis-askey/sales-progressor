import "server-only";
// Agent-facing WhatsApp Cloud reads (Phase 4). EVERY read here is scoped via
// lib/security/access-scope (Law 7): a thread is only visible when its sale is
// in the caller's scope — unassigned/dismissed conversations never reach agent
// surfaces (they live in the Command Centre queue until a human files them).

import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { windowOpenUntil } from "@/lib/integrations/whatsapp-cloud/routing";
import type { Session } from "next-auth";

export type ThreadSummary = {
  id: string;
  kind: string;
  displayName: string | null;
  waId: string;
  side: string | null;
  transactionId: string;
  transactionAddress: string;
  lastPreview: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadCount: number;
  windowOpenUntil: string | null; // null = reply window closed
  // Sending exists only on real Cloud numbers; bridge-captured conversations
  // are read-only by design (pivot 2026-10-18) — the UI hides the composer.
  canSend: boolean;
};

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  senderLabel: string | null;
  failureReason: string | null;
  at: string;
  // Media (Phase 4b): a signed, time-limited URL to our stored copy, plus the
  // kind that drives rendering (image inline, audio player, file link).
  mediaUrl: string | null;
  mediaKind: string | null;
  mediaFilename: string | null;
  // "Show its working" (promises rebuild 2026-10-19): the to-do the promise
  // scanner created from this message, rendered as a small tag under the
  // bubble. possible=true → the grey "?" tag (waiting in the possibles pile).
  // Internal viewers only while the founder test gate is on; null otherwise.
  todoTag: { title: string; dueAt: string | null; possible: boolean; done: boolean } | null;
};

function toSummary(t: {
  id: string; kind: string; displayName: string | null; waId: string; side: string | null;
  transactionId: string | null; lastPreview: string | null; lastInboundAt: Date | null;
  lastOutboundAt: Date | null; unreadCount: number;
  transaction: { propertyAddress: string } | null;
  businessNumber: { ownerType: string };
}): ThreadSummary {
  return {
    id: t.id,
    kind: t.kind,
    displayName: t.displayName,
    waId: t.waId,
    side: t.side,
    transactionId: t.transactionId ?? "",
    transactionAddress: t.transaction?.propertyAddress ?? "",
    lastPreview: t.lastPreview,
    lastInboundAt: t.lastInboundAt?.toISOString() ?? null,
    lastOutboundAt: t.lastOutboundAt?.toISOString() ?? null,
    unreadCount: t.unreadCount,
    windowOpenUntil: windowOpenUntil(t.lastInboundAt)?.toISOString() ?? null,
    canSend: t.businessNumber.ownerType !== "bridge",
  };
}

const THREAD_INCLUDE = {
  transaction: { select: { propertyAddress: true } },
  businessNumber: { select: { ownerType: true } },
} as const;

// All mapped conversations on one file (the per-file WhatsApp tab).
export async function getFileThreads(session: Session, transactionId: string): Promise<ThreadSummary[]> {
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];
  const threads = await prisma.whatsAppThread.findMany({
    where: { transactionId, assignmentState: { in: ["auto", "manual"] } },
    orderBy: [{ lastInboundAt: "desc" }],
    include: THREAD_INCLUDE,
  });
  return threads.map(toSummary);
}

// The central inbox: every mapped conversation across the caller's permitted
// sales, busiest first.
export async function listInboxThreads(session: Session): Promise<ThreadSummary[]> {
  const scope = getAccessScope(session);
  const threads = await prisma.whatsAppThread.findMany({
    where: {
      assignmentState: { in: ["auto", "manual"] },
      transaction: { is: scopeTransactionWhere(scope) },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: THREAD_INCLUDE,
  });
  return threads.map(toSummary);
}

// Scope guard for a single thread: resolves it only when its sale is in scope.
async function guardThread(session: Session, threadId: string) {
  const scope = getAccessScope(session);
  return prisma.whatsAppThread.findFirst({
    where: { id: threadId, transaction: { is: scopeTransactionWhere(scope) } },
    include: THREAD_INCLUDE,
  });
}

// Conversation history (optionally only messages after a watermark, for polls).
export async function getThreadMessages(
  session: Session,
  threadId: string,
  afterIso?: string,
): Promise<{ thread: ThreadSummary; messages: ThreadMessage[] } | null> {
  const thread = await guardThread(session, threadId);
  if (!thread) return null;
  const after = afterIso ? new Date(afterIso) : null;
  const rows = await prisma.outboundMessage.findMany({
    where: {
      threadId,
      type: { in: ["inbound", "outbound"] },
      ...(after ? { createdAt: { gt: after } } : {}),
    },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
    take: 500,
    select: { id: true, type: true, content: true, status: true, senderLabel: true, failureReason: true, sentAt: true, createdAt: true, mediaUrl: true, providerWebhookData: true },
  });
  // Sign stored media paths in one round trip (1h links; re-signed each read).
  const { getWhatsAppMediaSignedUrlMap } = await import("@/lib/supabase-storage");
  const signed = await getWhatsAppMediaSignedUrlMap(rows.map((r) => r.mediaUrl));

  // Promise-scanner tags, internal viewers only (the tasks are internal-self-
  // assigned while the founder test gate is on; agency users must not see them).
  const role = session.user.role;
  const internalViewer = role === "sales_progressor" || role === "admin" || role === "superadmin";
  const tagByMessageId = new Map<string, ThreadMessage["todoTag"]>();
  if (internalViewer && rows.length) {
    const tasks = await prisma.manualTask.findMany({
      where: { sourceMessageId: { in: rows.map((r) => r.id) } },
      select: { sourceMessageId: true, title: true, dueDate: true, isPossible: true, status: true },
    });
    // One tag per message: prefer a real to-do over a possible.
    for (const t of tasks) {
      if (!t.sourceMessageId) continue;
      const existing = tagByMessageId.get(t.sourceMessageId);
      if (existing && !existing.possible) continue;
      tagByMessageId.set(t.sourceMessageId, {
        title: t.title,
        dueAt: t.dueDate?.toISOString() ?? null,
        possible: t.isPossible,
        done: t.status === "done",
      });
    }
  }

  return {
    thread: toSummary(thread),
    messages: rows.map((r) => {
      const media = (r.providerWebhookData as { media?: { kind?: string; filename?: string } } | null)?.media;
      return {
        id: r.id,
        direction: r.type === "inbound" ? ("inbound" as const) : ("outbound" as const),
        content: r.content,
        status: r.status,
        senderLabel: r.senderLabel,
        failureReason: r.failureReason,
        at: (r.sentAt ?? r.createdAt).toISOString(),
        mediaUrl: r.mediaUrl ? signed.get(r.mediaUrl) ?? null : null,
        mediaKind: media?.kind ?? null,
        mediaFilename: media?.filename ?? null,
        todoTag: tagByMessageId.get(r.id) ?? null,
      };
    }),
  };
}

// Opening a conversation clears its unread badge (simple v1: per-thread, not
// per-user — one team works a file at a time in practice).
export async function markThreadRead(session: Session, threadId: string): Promise<void> {
  const thread = await guardThread(session, threadId);
  if (!thread) return;
  await prisma.whatsAppThread.update({ where: { id: threadId }, data: { unreadCount: 0 } });
}
