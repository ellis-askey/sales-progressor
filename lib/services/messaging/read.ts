// Native messaging — staff-side read layer (Phase 1).
//
// Resolves the Buyer and Seller conversations for a file, their message history,
// the participant names (active-round principals with portal access), and the
// viewing staff user's unread count. Read-only: it does NOT create conversations
// (the send path does that lazily via getOrCreateConversation), so merely opening
// the tab writes nothing.
//
// Security is enforced by the CALLER (the page gate + the action guard) — this
// helper trusts the transactionId it's given. Never call it without first
// confirming canUseMessages + fileInMessagesPilot + access-scope ownership.

import { prisma } from "@/lib/prisma";
import { isMessagingParticipant, sideForRoleType } from "./side";
import { unreadCount } from "./unread";
import type { MessagingSide } from "./side";
import type { StaffFileMessaging, StaffMessageView, StaffSideData } from "./types";

const SIDE_LABEL: Record<MessagingSide, string> = { buyer: "Buyer", seller: "Seller" };

const MESSAGE_SELECT = {
  id: true,
  clientMsgId: true,
  body: true,
  senderKind: true,
  senderUserId: true,
  createdAt: true,
  senderUser: { select: { name: true } },
  senderContact: { select: { name: true } },
} as const;

export async function getStaffFileMessaging(
  transactionId: string,
  viewerUserId: string,
): Promise<StaffFileMessaging> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  const activeRound = tx?.activeBuyerRoundId ?? null;

  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId },
    select: {
      id: true,
      name: true,
      roleType: true,
      isPrincipal: true,
      portalEligible: true,
      buyerRoundId: true,
    },
  });

  const sides: StaffSideData[] = [];
  for (const side of ["buyer", "seller"] as const) {
    const participants = contacts.filter(
      (c) => sideForRoleType(c.roleType) === side && isMessagingParticipant(c, activeRound),
    );
    const buyerRoundId = side === "buyer" ? activeRound : null;
    const conversation = await prisma.conversation.findFirst({
      where: { transactionId, side, buyerRoundId },
      select: { id: true },
    });

    let messages: StaffMessageView[] = [];
    let unread = 0;
    if (conversation) {
      const rows = await prisma.message.findMany({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: MESSAGE_SELECT,
      });
      messages = rows.map((m) => ({
        id: m.id,
        clientMsgId: m.clientMsgId,
        body: m.body,
        senderKind: m.senderKind,
        senderName:
          m.senderKind === "staff" ? (m.senderUser?.name ?? null) : (m.senderContact?.name ?? null),
        mine: m.senderKind === "staff" && m.senderUserId === viewerUserId,
        createdAt: m.createdAt.toISOString(),
      }));
      const receipt = await prisma.messageReceipt.findFirst({
        where: { conversationId: conversation.id, participantUserId: viewerUserId },
        select: { lastReadAt: true },
      });
      unread = unreadCount(
        rows.map((m) => ({ createdAt: m.createdAt, senderKind: m.senderKind })),
        "staff",
        receipt?.lastReadAt ?? null,
      );
    }

    sides.push({
      side,
      label: SIDE_LABEL[side],
      participantNames: participants.map((p) => p.name),
      conversationId: conversation?.id ?? null,
      messages,
      unread,
    });
  }

  return { sides };
}

// Mark a conversation read (now) for a staff user. Race-safe against the partial
// unique index on (conversationId, participantUserId): if a concurrent request
// created the receipt first, fall back to updating it.
export async function markConversationReadForUser(
  conversationId: string,
  userId: string,
): Promise<void> {
  const existing = await prisma.messageReceipt.findFirst({
    where: { conversationId, participantUserId: userId },
    select: { id: true },
  });
  if (existing) {
    await prisma.messageReceipt.update({
      where: { id: existing.id },
      data: { lastReadAt: new Date() },
      select: { id: true },
    });
    return;
  }
  try {
    await prisma.messageReceipt.create({
      data: {
        conversationId,
        participantKind: "staff",
        participantUserId: userId,
        lastReadAt: new Date(),
      },
      select: { id: true },
    });
  } catch {
    const row = await prisma.messageReceipt.findFirst({
      where: { conversationId, participantUserId: userId },
      select: { id: true },
    });
    if (row) {
      await prisma.messageReceipt.update({
        where: { id: row.id },
        data: { lastReadAt: new Date() },
        select: { id: true },
      });
    }
  }
}
