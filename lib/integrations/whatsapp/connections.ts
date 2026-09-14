// WhatsApp per-connection scoping (agent-facing Phase 2).
//
// Each agent-linked WhatsApp is a WhatsAppConnection row; its `id` is the
// connectionId the bridge stamps on every message it forwards. Resolving that id
// to the owning user's agency is what keeps one agency's messages off another
// agency's files (multi-tenant safety, Law 7). The legacy internal number sends
// no connectionId and stays unscoped (matches across all agencies, unchanged).

import { prisma } from "@/lib/prisma";

export type ConnectionScope = {
  connectionId: string;
  userId: string;
  agencyId: string | null; // null for an internal-staff connection (no agency)
};

// Look up which connection (and therefore which agency) a message came through.
// Returns null when the connectionId is unknown — the caller drops the message
// rather than capturing from a connection it can't attribute.
export async function resolveConnectionScope(connectionId: string): Promise<ConnectionScope | null> {
  const conn = await prisma.whatsAppConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, userId: true, user: { select: { agencyId: true } } },
  });
  if (!conn) return null;
  return { connectionId: conn.id, userId: conn.userId, agencyId: conn.user?.agencyId ?? null };
}

// Record that a message just flowed through a connection: keeps lastMessageAt /
// lastSeenAt fresh for the connect UI and the Command Centre status. Best-effort
// — never fail ingest if the connection was removed mid-flight.
export async function touchConnectionMessage(connectionId: string): Promise<void> {
  const now = new Date();
  await prisma.whatsAppConnection
    .update({ where: { id: connectionId }, data: { lastMessageAt: now, lastSeenAt: now } })
    .catch(() => {
      /* connection removed between resolve and touch — ignore */
    });
}
