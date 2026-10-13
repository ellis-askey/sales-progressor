"use server";
// Agent-facing WhatsApp Cloud actions (Phase 4). Session-gated; every read and
// send resolves the thread through the access scope (Law 7) — the service and
// send layers never trust a raw thread id from the client.

import { requireSession } from "@/lib/session";
import { getThreadMessages, markThreadRead } from "@/lib/services/whatsapp-cloud-inbox";
import type { ThreadSummary, ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";

export async function listThreadMessagesAction(
  threadId: string,
  afterIso?: string,
): Promise<{ thread: ThreadSummary; messages: ThreadMessage[] } | null> {
  const session = await requireSession();
  return getThreadMessages(session, threadId, afterIso);
}

export async function markThreadReadAction(threadId: string): Promise<void> {
  const session = await requireSession();
  await markThreadRead(session, threadId);
}

export async function sendWaMessageAction(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; error?: string; windowClosed?: boolean }> {
  const session = await requireSession();
  // Scope check first: the thread must belong to a sale this user can see.
  const visible = await getThreadMessages(session, threadId);
  if (!visible) return { ok: false, error: "Conversation not found." };
  const { sendThreadText } = await import("@/lib/integrations/whatsapp-cloud/send");
  const res = await sendThreadText({
    threadId,
    body,
    senderUserId: session.user.id,
    senderName: session.user.name ?? "Agent",
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error, windowClosed: res.windowClosed };
}
