// Native messaging — optimistic client-state reducers (Phase 1).
//
// Pure functions (no React, no prisma, no server-only) that the staff tab uses
// to reconcile optimistic sends and merge fresh server snapshots. Extracted so
// the send / retry / failure / freshness logic is unit-testable without a DOM.

import type { StaffMessageView } from "./types";

export type LocalMsg = StaffMessageView & { status?: "sending" | "failed" };

export type SendOutcome = { ok: true; message: StaffMessageView } | { ok: false };

// The optimistic bubble for a staff send: shown instantly as "sending". The
// clientMsgId is the STABLE idempotency key reused on every retry — never
// regenerate it, or a landed write could duplicate.
export function makeOptimistic(clientMsgId: string, body: string, createdAtIso: string): LocalMsg {
  return {
    id: clientMsgId,
    clientMsgId,
    body,
    senderKind: "staff",
    senderName: "You",
    mine: true,
    createdAt: createdAtIso,
    status: "sending",
  };
}

// Reconcile the matching optimistic message with a send outcome. Success →
// replace it with the server message (status cleared). ANY failure — a returned
// {ok:false} OR a thrown transport error (the caller passes {ok:false}) → flip
// it to "failed", preserving body + clientMsgId so Retry re-sends the same id.
export function reconcileSend(
  list: LocalMsg[],
  clientMsgId: string,
  outcome: SendOutcome,
): LocalMsg[] {
  return list.map((m) =>
    m.clientMsgId === clientMsgId
      ? outcome.ok
        ? { ...outcome.message, status: undefined }
        : { ...m, status: "failed" as const }
      : m,
  );
}

// Flip a failed message back to "sending" for a retry, keeping its clientMsgId.
export function markRetrying(list: LocalMsg[], clientMsgId: string): LocalMsg[] {
  return list.map((m) => (m.clientMsgId === clientMsgId ? { ...m, status: "sending" as const } : m));
}

// Merge a fresh server snapshot into the local list: the server messages become
// the confirmed truth, and any still-pending (sending/failed) local messages the
// server does NOT yet have are kept appended. Keying on clientMsgId means a
// "write succeeded but the response was lost" bubble is replaced by its real
// server row on the next refetch (no duplicate), and a genuinely un-sent pending
// message is preserved.
export function mergeServerMessages(local: LocalMsg[], server: StaffMessageView[]): LocalMsg[] {
  const serverIds = new Set(server.map((m) => m.clientMsgId));
  const stillPending = local.filter(
    (m) => (m.status === "sending" || m.status === "failed") && !serverIds.has(m.clientMsgId),
  );
  return [...server.map((m) => ({ ...m }) as LocalMsg), ...stillPending];
}
