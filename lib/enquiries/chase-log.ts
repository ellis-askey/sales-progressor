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

// Log a sent chase email to the file's INTERNAL activity timeline — the same
// OutboundMessage feed the manual "log an email" writes to, so a chase shows on
// the file exactly like an email we typed ourselves. Internal only:
// visibleToClient stays false, so it never surfaces on the client portal. This
// mirrors how the solicitor-confirm chase records its sends. Fire-and-forget:
// callers wrap it in .catch() so it can never break a send.
export async function logEnquiryChaseComm(
  args: {
    transactionId: string;
    agencyId?: string | null;
    subject: string;
    body: string;
    recipientEmail: string;
    recipientName?: string | null;
    createdById?: string | null;
    sentAt?: Date;
  },
  db: Db = prisma,
): Promise<void> {
  const at = args.sentAt ?? new Date();
  await db.outboundMessage.create({
    data: {
      transactionId: args.transactionId,
      agencyId: args.agencyId ?? null,
      type: "outbound",
      method: "email",
      channel: "email",
      purpose: "chase",
      status: "sent",
      isAutomated: true,
      visibleToClient: false, // internal record only — never on the client portal
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName ?? undefined,
      subject: args.subject,
      content: args.body,
      contactIds: [],
      createdById: args.createdById ?? undefined,
      createdByRole: "system",
      sentAt: at,
      createdAt: at,
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
