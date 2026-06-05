import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cascadeChainWithdrawal, cascadeChainRemarketing } from "@/lib/chain/withdrawal";
import type { ChainNotificationType, ChainWithdrawalStatus } from "@prisma/client";

const VALID_STATUSES = ["REMARKETING", "WAITING", "BREAK_CHAIN", "WITHDRAW"] as const;
type ResponseStatus = (typeof VALID_STATUSES)[number];

// Which response statuses are valid for each notification type. Anything else
// is a 400 "That option isn't valid for this notification" — never a 500.
const VALID_RESPONSES_BY_TYPE: Record<ChainNotificationType, ResponseStatus[]> = {
  LOST_BUYER: ["REMARKETING", "WITHDRAW"],
  LOST_PURCHASE: ["REMARKETING", "BREAK_CHAIN", "WITHDRAW"],
  ASKED_TO_WAIT: ["WAITING", "WITHDRAW"],
  // Closed-loop arc (2026-06-05): BUYER_FOUND + CHAIN_DETACHED are
  // informational by design — no response options. The chain widget
  // surfaces them as read-only "we told you" cards; if the agent wants
  // to act on the news, they go into their own file and use the normal
  // controls (relist, withdraw, status changes). The API rejects any
  // attempted response on these types with a 400.
  BUYER_FOUND: [],
  CHAIN_DETACHED: [],
};

// Map the agent's chosen status to the ChainWithdrawalStatus enum value stored
// on both the notification row and (denormalised) on the recipient's link.
// WITHDRAW becomes WITHDRAWN on the link.
function statusToLinkStatus(status: ResponseStatus): ChainWithdrawalStatus {
  if (status === "WITHDRAW") return "WITHDRAWN";
  return status; // REMARKETING / WAITING / BREAK_CHAIN match directly
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const session = await requireSession();
  const { notificationId } = await params;

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status as ResponseStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status as ResponseStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const notification = await prisma.chainNotificationQueue.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      recipientUserId: true,
      recipientLinkId: true,
      type: true,
      direction: true,
      response: true,
      recipientLink: { select: { transactionId: true } },
    },
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  if (notification.recipientUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (notification.response) {
    return NextResponse.json(
      { error: "This notification has already been responded to — please reload" },
      { status: 400 },
    );
  }
  if (!VALID_RESPONSES_BY_TYPE[notification.type].includes(status)) {
    return NextResponse.json(
      { error: "That option isn't valid for this notification" },
      { status: 400 },
    );
  }

  const now = new Date();

  // Mark the notification responded
  await prisma.chainNotificationQueue.update({
    where: { id: notificationId },
    data: { response: statusToLinkStatus(status), respondedAt: now },
  });

  // Denormalised link state for badge rendering
  await prisma.chainLink.update({
    where: { id: notification.recipientLinkId },
    data: {
      withdrawalStatus: statusToLinkStatus(status),
      withdrawalRespondedAt: now,
    },
  });

  // WITHDRAW: also mark the recipient's transaction withdrawn + fire fresh cascade.
  // The transaction-side update happens before the cascade so the cascade's
  // "find next claimed link" walk sees the new WITHDRAWN state correctly.
  if (status === "WITHDRAW") {
    if (notification.recipientLink.transactionId) {
      await prisma.propertyTransaction.update({
        where: { id: notification.recipientLink.transactionId },
        data: { status: "withdrawn" },
      });
    }
    cascadeChainWithdrawal(notification.recipientLinkId).catch(console.error);
  } else if (status === "REMARKETING") {
    cascadeChainRemarketing(notification.recipientLinkId, notification.direction).catch(console.error);
  }
  // BREAK_CHAIN, WAITING → no cascade

  return NextResponse.json({ ok: true });
}
