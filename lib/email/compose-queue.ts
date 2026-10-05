// Scheduled-send for the agent email composer (critique 2026-10-05, phase 2).
//
// Reuses the existing OutboundEmailQueue + hourly drain (no new table, no new
// cron). A scheduled compose email is one queue row with emailType
// "AGENT_COMPOSE"; the drain has a dedicated branch that sends it via sendEmail
// (multi-To / Cc / Bcc / attachments) and logs it to the file's timeline. The
// row's recipientUserId is the SENDER (satisfies the one-recipient invariant and
// lets us list/cancel a user's own scheduled sends); the real recipients live in
// the payload. See lib/email/outboundQueue.ts drain branch.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const AGENT_COMPOSE_TYPE = "AGENT_COMPOSE";

export type ComposeQueuePayload = {
  transactionId: string;
  saleLine1: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html: string;
  from: string;
  replyTo?: string;
  attachments?: { content: string; filename: string; type: string }[];
  createdById: string;
  createdByRole: string;
  ccEmails: string | null;
  recipientName: string | null;
  contactIds: string[];
};

export async function enqueueComposedEmail(payload: ComposeQueuePayload, scheduledFor: Date): Promise<void> {
  await prisma.outboundEmailQueue.create({
    data: {
      emailType: AGENT_COMPOSE_TYPE,
      // Unique per scheduled send so the (emailType, sourceId, recipientUserId)
      // unique index never collides across a sender's scheduled emails.
      sourceId: `compose:${payload.transactionId}:${payload.createdById}:${scheduledFor.getTime()}`,
      recipientEmail: payload.to[0],
      recipientUserId: payload.createdById, // the sender — see header note
      payload: payload as unknown as Prisma.InputJsonValue,
      scheduledFor,
    },
  });
}

export type ScheduledComposeRow = {
  id: string;
  saleLine1: string;
  to: string[];
  subject: string;
  scheduledFor: string; // ISO
};

// A sender's own pending scheduled compose emails (not yet sent / errored).
export async function listScheduledComposeEmails(senderUserId: string): Promise<ScheduledComposeRow[]> {
  const rows = await prisma.outboundEmailQueue.findMany({
    where: { emailType: AGENT_COMPOSE_TYPE, recipientUserId: senderUserId, sentAt: null, errorAt: null },
    orderBy: { scheduledFor: "asc" },
    select: { id: true, scheduledFor: true, payload: true },
    take: 50,
  });
  return rows.map((r) => {
    const p = r.payload as unknown as ComposeQueuePayload;
    return { id: r.id, saleLine1: p.saleLine1 ?? "", to: p.to ?? [], subject: p.subject ?? "", scheduledFor: r.scheduledFor.toISOString() };
  });
}

// Cancel a scheduled compose email. Only the sender who created it can cancel,
// and only while it hasn't been sent yet. Returns true when a row was removed.
export async function cancelScheduledComposeEmail(id: string, senderUserId: string): Promise<boolean> {
  const res = await prisma.outboundEmailQueue.deleteMany({
    where: { id, emailType: AGENT_COMPOSE_TYPE, recipientUserId: senderUserId, sentAt: null },
  });
  return res.count > 0;
}
