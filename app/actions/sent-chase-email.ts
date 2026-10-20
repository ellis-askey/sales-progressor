"use server";

// Fetch one sent email (the stored OutboundMessage) so a surface can open a
// true-to-inbox copy. Read-only + access-scoped: the message's file must be in
// the viewer's scope (Law 7) — that scope check is the real guard. Any real sent
// message is returnable (chase, milestone update, etc.); internal notes are not.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export type SentChaseEmail = {
  subject: string;
  html: string | null; // the exact rendered HTML we sent; null for legacy sends
  text: string;        // plain-text fallback
  recipientName: string | null;
  recipientEmail: string | null;
  sentAt: string | null; // ISO
  delivery: "sent" | "delivered" | "opened";
};

export async function getSentChaseEmailAction(id: string): Promise<SentChaseEmail> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const msg = await prisma.outboundMessage.findUnique({
    where: { id },
    select: {
      transactionId: true, type: true, subject: true, content: true, sentEmailHtml: true,
      recipientName: true, recipientEmail: true, sentAt: true, deliveredAt: true, openedAt: true,
    },
  });
  if (!msg || !msg.transactionId || msg.type === "internal_note") throw new Error("Email not found");

  // The message's file must be in scope for this viewer.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, msg.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Email not found");

  return {
    subject: msg.subject ?? "",
    html: msg.sentEmailHtml ?? null,
    text: msg.content ?? "",
    recipientName: msg.recipientName ?? null,
    recipientEmail: msg.recipientEmail ?? null,
    sentAt: msg.sentAt ? msg.sentAt.toISOString() : null,
    delivery: msg.openedAt ? "opened" : msg.deliveredAt ? "delivered" : "sent",
  };
}
