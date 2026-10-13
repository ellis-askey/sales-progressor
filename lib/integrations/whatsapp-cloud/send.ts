import "server-only";
// Phase 4 send path (REBUILD_PLAN §C3): one function every surface uses to
// send a free-form text on a thread. Honest by construction — the ledger row
// starts `queued`, flips to `sent` only when Meta ACCEPTS the message, and a
// rejection lands as `failed` with the reason. Delivery/read truth arrives via
// the status webhooks (Phase 3 applies them advance-only).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendCloudText } from "./client";
import { windowOpenUntil } from "./routing";

export type ThreadSendResult =
  | { ok: true; messageId: string; wamid: string }
  | { ok: false; error: string; windowClosed?: boolean };

export async function sendThreadText(args: {
  threadId: string;
  body: string;
  senderUserId: string;
  senderName: string;
}): Promise<ThreadSendResult> {
  const body = args.body.trim();
  if (!body) return { ok: false, error: "Nothing to send." };
  if (body.length > 4000) return { ok: false, error: "That message is too long for WhatsApp." };

  const thread = await prisma.whatsAppThread.findUnique({
    where: { id: args.threadId },
    include: { businessNumber: { select: { phoneNumberId: true } }, transaction: { select: { id: true, agencyId: true } } },
  });
  if (!thread) return { ok: false, error: "Conversation not found." };
  if (thread.kind !== "direct") return { ok: false, error: "Group sending arrives with the groups phase." };

  // The 24-hour rule, enforced before we even try: outside the window Meta
  // would reject with error 131047, so we say it plainly up front instead.
  if (!windowOpenUntil(thread.lastInboundAt)) {
    return {
      ok: false,
      windowClosed: true,
      error: "The 24-hour reply window has closed. A free-form message can't be sent until they message again (template messages arrive with the chasing phase).",
    };
  }

  // Ledger-first: the row exists as `queued` before any network call, so a
  // crash mid-send can never produce an invisible message.
  const row = await prisma.outboundMessage.create({
    data: {
      agencyId: thread.transaction?.agencyId ?? null,
      transactionId: thread.transactionId,
      threadId: thread.id,
      channel: "whatsapp",
      method: "whatsapp",
      type: "outbound",
      status: "queued",
      purpose: "other",
      content: body,
      senderLabel: args.senderName,
      recipientName: thread.displayName,
      recipientHandle: `+${thread.waId}`,
      contactIds: thread.contactIds,
      createdById: args.senderUserId,
      providerWebhookData: { source: "cloud", waId: thread.waId, type: "text" } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  const res = await sendCloudText({ phoneNumberId: thread.businessNumber.phoneNumberId, to: thread.waId, body });

  if (!res.ok) {
    await prisma.outboundMessage.update({
      where: { id: row.id },
      data: { status: "failed", failedAt: new Date(), failureReason: res.error },
    });
    return { ok: false, error: res.error, windowClosed: res.errorCode === 131047 };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.outboundMessage.update({
      where: { id: row.id },
      data: { status: "sent", sentAt: now, providerMessageId: res.wamid },
    }),
    prisma.whatsAppThread.update({
      where: { id: thread.id },
      data: { lastOutboundAt: now, lastPreview: body.slice(0, 160) },
    }),
  ]);
  return { ok: true, messageId: row.id, wamid: res.wamid };
}
