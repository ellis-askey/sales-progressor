// Chase-send logging for the enquiries-chase experiment (Command Centre board).
// One row per chase email sent, later stamped with whether the recipient opened
// their link and what they did. Kept tiny and fire-and-forget so it can never
// break a send or a page render.

import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;
type Kind = "raise" | "reply_loop";
type Recipient = "buyer" | "seller_solicitor" | "buyer_solicitor";
type SolicitorRecipient = "seller_solicitor" | "buyer_solicitor";
type ResponseType = "update" | "date" | "confirm";

// Map a solicitor-page side to the recipient enum.
export function recipientForSide(side: "vendor" | "purchaser"): SolicitorRecipient {
  return side === "vendor" ? "seller_solicitor" : "buyer_solicitor";
}

export async function logChaseSend(
  args: { transactionId: string; kind: Kind; recipient: Recipient; recipientName?: string | null },
  db: Db = prisma,
): Promise<void> {
  await db.chaseSend.create({
    data: {
      transactionId: args.transactionId,
      kind: args.kind,
      recipient: args.recipient,
      recipientName: args.recipientName ?? null,
    },
  });
}

// Stamp the most recent still-unopened send to this recipient as opened.
export async function markChaseOpened(transactionId: string, recipient: SolicitorRecipient): Promise<void> {
  const latest = await prisma.chaseSend.findFirst({
    where: { transactionId, recipient, openedAt: null },
    orderBy: { sentAt: "desc" },
    select: { id: true },
  });
  if (latest) await prisma.chaseSend.update({ where: { id: latest.id }, data: { openedAt: new Date() } });
}

// Stamp the most recent un-responded send to this recipient with the action
// taken (also records the open, since acting implies opening).
export async function markChaseResponded(
  transactionId: string,
  recipient: SolicitorRecipient,
  responseType: ResponseType,
): Promise<void> {
  const latest = await prisma.chaseSend.findFirst({
    where: { transactionId, recipient, respondedAt: null },
    orderBy: { sentAt: "desc" },
    select: { id: true, openedAt: true },
  });
  if (latest) {
    await prisma.chaseSend.update({
      where: { id: latest.id },
      data: { respondedAt: new Date(), responseType, openedAt: latest.openedAt ?? new Date() },
    });
  }
}
