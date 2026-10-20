import "server-only";
// Phase 3 (REBUILD_PLAN §G P3): the honest ledger. WhatsApp Cloud messages on
// ASSIGNED threads become OutboundMessage rows — the same spine the timeline,
// indicators and admin log already read — and their status column is driven by
// real provider webhooks (advance-only), never written on faith. Unassigned
// threads keep their messages in the event store; assignment backfills them,
// so no message is ever lost to a late mapping.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { statusAdvances } from "./signature";
import { previewFromMessage, ledgerUpdateForWaStatus, waRankOfLedgerStatus, mediaRefFromMessage, mediaPlaceholder } from "./routing";
import { fetchAndStoreCloudMedia } from "./media";

type WebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string; // unix seconds
  text?: { body?: string };
  group_id?: string;
};

type ThreadLite = {
  id: string;
  waId: string;
  displayName: string | null;
  transactionId: string | null;
  contactIds: string[];
};

function messageTime(msg: WebhookMessage, fallback: Date): Date {
  const secs = Number(msg.timestamp);
  return Number.isFinite(secs) && secs > 0 ? new Date(secs * 1000) : fallback;
}

// Write one INBOUND cloud message into the ledger. No-op when the thread has
// no sale yet, or the wamid already exists (app-level dedup + the prod partial
// unique index as belt-and-braces). Media messages fetch + store their file
// (Phase 4b) best-effort — on failure the typed placeholder stands and the raw
// event remains for a retry.
export async function writeInboundLedgerRow(
  thread: ThreadLite,
  msg: WebhookMessage,
  receivedAt: Date,
  phoneNumberId?: string | null,
): Promise<void> {
  if (!thread.transactionId || !msg.id) return;
  const existing = await prisma.outboundMessage.findFirst({
    where: { providerMessageId: msg.id, channel: "whatsapp" },
    select: { id: true },
  });
  if (existing) return;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: thread.transactionId },
    select: { agencyId: true },
  });
  const at = messageTime(msg, receivedAt);

  const media = mediaRefFromMessage(msg);
  let mediaUrl: string | null = null;
  if (media && phoneNumberId) {
    mediaUrl = await fetchAndStoreCloudMedia({ mediaId: media.mediaId, phoneNumberId, mimeType: media.mimeType });
  }
  const body = msg.type === "text"
    ? (msg.text?.body ?? "")
    : media
      ? (media.caption ?? mediaPlaceholder(media))
      : previewFromMessage(msg);

  try {
    await prisma.outboundMessage.create({
      data: {
        agencyId: tx?.agencyId ?? null,
        transactionId: thread.transactionId,
        threadId: thread.id,
        channel: "whatsapp",
        method: "whatsapp",
        type: "inbound",
        // Inbound truth: it exists because it reached us — delivered, with the
        // original WhatsApp send time, not our processing time.
        status: "delivered",
        purpose: "other",
        content: body || "[message]",
        sentAt: at,
        deliveredAt: at,
        providerMessageId: msg.id,
        senderLabel: thread.displayName ?? `+${thread.waId}`,
        recipientHandle: `+${thread.waId}`,
        contactIds: thread.contactIds,
        mediaUrl,
        createdByRole: "system",
        providerWebhookData: {
          source: "cloud",
          waId: thread.waId,
          type: msg.type ?? "text",
          ...(media ? { media: { kind: media.kind, mime: media.mimeType, filename: media.filename, voice: media.voice } } : {}),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // P2002 = the prod partial unique index beat us to it (concurrent webhook
    // replay). Exactly the no-op we want.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }

  // A client WhatsApp is real activity — advance the file's last-activity clock
  // so "last comms" + idle signals count it. Forward-only on the real send time.
  if (thread.transactionId) {
    await prisma.propertyTransaction
      .updateMany({
        where: { id: thread.transactionId, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: at } }] },
        data: { lastActivityAt: at },
      })
      .catch(() => {});
  }
}

// On (re)assignment: create ledger rows for every already-routed message of
// this thread that doesn't have one — history arrives with the mapping.
export async function backfillThreadLedger(threadId: string): Promise<number> {
  const thread = await prisma.whatsAppThread.findUnique({
    where: { id: threadId },
    select: {
      id: true, waId: true, displayName: true, transactionId: true, contactIds: true,
      businessNumber: { select: { phoneNumberId: true } },
    },
  });
  if (!thread?.transactionId) return 0;
  const events = await prisma.whatsAppCloudEvent.findMany({
    where: { threadId, kind: "message" },
    orderBy: { receivedAt: "asc" },
    select: { wamid: true, payload: true, receivedAt: true },
  });
  let created = 0;
  for (const event of events) {
    const value = event.payload as { messages?: WebhookMessage[] };
    const msg = (value.messages ?? []).find((m) => m.id === event.wamid) ?? (value.messages ?? [])[0];
    if (!msg) continue;
    const before = await prisma.outboundMessage.count({ where: { providerMessageId: msg.id, channel: "whatsapp" } });
    await writeInboundLedgerRow(thread, msg, event.receivedAt, thread.businessNumber.phoneNumberId);
    if (before === 0) created += 1;
  }
  return created;
}

// Move a thread's whole ledger history to its (new) sale — reassignment is one
// sweep, exactly as promised in the plan. Null transactionId detaches (ignore).
export async function moveThreadLedger(threadId: string, transactionId: string | null): Promise<void> {
  let agencyId: string | null = null;
  if (transactionId) {
    const tx = await prisma.propertyTransaction.findUnique({ where: { id: transactionId }, select: { agencyId: true } });
    agencyId = tx?.agencyId ?? null;
  }
  await prisma.outboundMessage.updateMany({
    where: { threadId },
    data: { transactionId, agencyId },
  });
}

// Apply unprocessed STATUS events to their ledger rows: advance-only (a late
// `delivered` never regresses a `read`), with the failure reason preserved.
export async function applyUnprocessedStatuses(limit = 100): Promise<number> {
  const events = await prisma.whatsAppCloudEvent.findMany({
    where: { kind: "status", processedAt: null },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });
  let applied = 0;
  for (const event of events) {
    const done: Prisma.WhatsAppCloudEventUpdateInput = { processedAt: new Date() };
    if (event.wamid && event.status) {
      const row = await prisma.outboundMessage.findFirst({
        where: { providerMessageId: event.wamid, channel: "whatsapp" },
        select: { id: true, status: true, threadId: true },
      });
      if (row) {
        done.threadId = row.threadId;
        const update = ledgerUpdateForWaStatus(event.status);
        if (update && statusAdvances(waRankOfLedgerStatus(row.status), event.status)) {
          // Failure detail from the webhook payload when present.
          const payload = event.payload as { statuses?: Array<{ id?: string; errors?: Array<{ title?: string; message?: string }> }> };
          const err = payload.statuses?.find((s) => s.id === event.wamid)?.errors?.[0];
          await prisma.outboundMessage.update({
            where: { id: row.id },
            data: {
              status: update.status,
              [update.stampField]: event.receivedAt,
              ...(update.status === "failed"
                ? { failureReason: err?.message ?? err?.title ?? "WhatsApp could not deliver this message." }
                : {}),
            },
          });
          // An accepted outbound send stamps the thread's reply-window side.
          if (update.status === "sent" && row.threadId) {
            await prisma.whatsAppThread.update({
              where: { id: row.threadId },
              data: { lastOutboundAt: event.receivedAt },
            }).catch(() => {});
          }
          applied += 1;
        }
      }
    }
    await prisma.whatsAppCloudEvent.update({ where: { id: event.id }, data: done });
  }
  return applied;
}
