import "server-only";
// Bridge → conversations adapter (pivot decision 2026-10-18, per founder: the
// Railway capture stays the transport; the NEW thread/ledger system becomes
// the filing cabinet behind it). Every captured message files into a
// WhatsAppThread so the modern per-file tab and inbox can display it; the old
// flat readers keep working untouched during the transition.
//
// Bridge connections have no Meta identity, so each one gets a synthetic row
// in the number registry (phoneNumberId "bridge:<connectionId>") — one
// registry for both transports means the thread/inbox machinery needs no
// special cases. These rows carry no real token (sending is impossible by
// design on captured numbers — read-only is the product).

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/token-crypto";

const BRIDGE_WABA = "bridge";

function bridgeKey(connectionId: string | null): string {
  return `bridge:${connectionId ?? "internal"}`;
}

export async function ensureBridgeNumber(connectionId: string | null): Promise<string> {
  const phoneNumberId = bridgeKey(connectionId);
  const existing = await prisma.whatsAppBusinessNumber.findUnique({ where: { phoneNumberId }, select: { id: true } });
  if (existing) return existing.id;
  // Human-readable phone for the registry row when the connection knows it.
  const conn = connectionId
    ? await prisma.whatsAppConnection.findUnique({ where: { id: connectionId }, select: { phoneNumber: true } })
    : null;
  const row = await prisma.whatsAppBusinessNumber.create({
    data: {
      ownerType: "bridge",
      ownerId: connectionId,
      wabaId: BRIDGE_WABA,
      phoneNumberId,
      displayPhone: conn?.phoneNumber ?? null,
      accessTokenEnc: encryptSecret("bridge-capture-no-token"),
      status: "active",
    },
    select: { id: true },
  });
  return row.id;
}

// File one captured message into its conversation. Called right after the
// ledger row is written; idempotent per message (threadId stamped once).
export async function fileBridgeMessageIntoThread(args: {
  connectionId: string | null;
  waChatId: string;
  isGroup: boolean;
  groupName: string | null;
  counterpartyLabel: string | null; // inbound sender label (names a DM thread)
  transactionId: string;
  side: "BUYER" | "SELLER" | null;
  messageRowId: string;
  isOurs: boolean;
  sentAt: Date;
  preview: string;
  // History conversion passes false so months of old messages don't open with
  // an inflated unread badge; live capture leaves it true.
  countUnread?: boolean;
}): Promise<void> {
  const businessNumberId = await ensureBridgeNumber(args.connectionId);
  let thread = await prisma.whatsAppThread.findUnique({
    where: { businessNumberId_waId: { businessNumberId, waId: args.waChatId } },
  });
  if (!thread) {
    thread = await prisma.whatsAppThread.create({
      data: {
        businessNumberId,
        kind: args.isGroup ? "group" : "direct",
        waId: args.waChatId,
        displayName: args.groupName ?? args.counterpartyLabel,
        groupSubject: args.groupName,
        transactionId: args.transactionId,
        side: args.side,
        assignmentState: "auto", // mapping came from the proven ingest routing
        contactIds: [],
      },
    });
  }
  await prisma.$transaction([
    prisma.whatsAppThread.update({
      where: { id: thread.id },
      data: {
        lastPreview: args.preview.slice(0, 160),
        ...(args.isOurs
          ? { lastOutboundAt: args.sentAt }
          : { lastInboundAt: args.sentAt, ...(args.countUnread === false ? {} : { unreadCount: { increment: 1 } }) }),
        ...(args.groupName && !thread.groupSubject ? { groupSubject: args.groupName, displayName: args.groupName } : {}),
      },
    }),
    prisma.outboundMessage.update({ where: { id: args.messageRowId }, data: { threadId: thread.id } }),
  ]);
}

// One-off back-conversion: file the months of ALREADY-captured bridge rows
// into conversations so the new screens open with full history. Idempotent and
// batched — run repeatedly (Command Centre button) until remaining hits zero.
// Paste-imported rows (no waChatId) are deliberately left to the legacy
// "imported history" rendering.
export async function convertBridgeHistory(batch = 1500): Promise<{ converted: number; remaining: number }> {
  const rows = await prisma.outboundMessage.findMany({
    where: { method: "whatsapp", threadId: null },
    orderBy: { sentAt: "asc" },
    take: batch,
    select: { id: true, transactionId: true, type: true, content: true, sentAt: true, createdAt: true, senderLabel: true, providerWebhookData: true },
  });

  let converted = 0;
  for (const r of rows) {
    const data = r.providerWebhookData as { source?: string; waChatId?: string; connectionId?: string | null; isGroup?: boolean; groupName?: string | null } | null;
    if (!data?.waChatId || !r.transactionId) continue; // paste import / unroutable — stays legacy
    const mapping = await prisma.whatsAppGroupMapping.findUnique({
      where: { waChatId: data.waChatId },
      select: { side: true },
    });
    await fileBridgeMessageIntoThread({
      connectionId: data.connectionId ?? null,
      waChatId: data.waChatId,
      isGroup: !!data.isGroup,
      groupName: data.groupName ?? null,
      counterpartyLabel: r.type === "inbound" ? r.senderLabel : null,
      transactionId: r.transactionId,
      side: mapping?.side ?? null,
      messageRowId: r.id,
      isOurs: r.type === "outbound",
      sentAt: r.sentAt ?? r.createdAt,
      preview: r.content,
      countUnread: false,
    });
    converted += 1;
  }

  // Remaining = rows still unthreaded that LOOK convertible (have a chat id).
  const unthreaded = await prisma.outboundMessage.findMany({
    where: { method: "whatsapp", threadId: null },
    select: { providerWebhookData: true },
    take: 5000,
  });
  const remaining = unthreaded.filter((r) => {
    const d = r.providerWebhookData as { waChatId?: string } | null;
    return !!d?.waChatId;
  }).length;

  return { converted, remaining };
}
