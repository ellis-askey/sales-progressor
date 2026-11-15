// Unread-count logic for a conversation, from a participant's read cursor.
// Pure — the persisted cursor lives in MessageReceipt (lastReadAt). This
// replaces the placeholder "count all client messages" used by the legacy
// PortalMessage path (lib/services/portal-messages.ts:83).

export type MessageForUnread = { createdAt: Date; senderKind: "staff" | "client" };

// Unread = messages from the OTHER party, created strictly after this viewer's
// read cursor. A null cursor (conversation never opened) means every message
// from the other party is unread. The viewer's own messages never count.
export function unreadCount(
  messages: MessageForUnread[],
  viewerKind: "staff" | "client",
  lastReadAt: Date | null,
): number {
  return messages.filter(
    (m) => m.senderKind !== viewerKind && (lastReadAt === null || m.createdAt > lastReadAt),
  ).length;
}
