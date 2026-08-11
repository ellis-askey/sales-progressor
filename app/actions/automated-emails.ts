"use server";

// Server actions for the Automated-emails detail drawer.
//
// Scope is always re-derived from the session here (never trusted from the
// client): every action verifies the target transaction is inside the caller's
// access scope before returning anything about it.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { sendChainEmail, isUserEmailSuppressed, isContactEmailSuppressed } from "@/lib/email";
import { recordEvent } from "@/lib/command/events/write";

export type PendingActionResult = { ok: true; message: string } | { ok: false; error: string };

// A queued email's transaction, resolved from the recipient contact, checked
// against the caller's scope. Returns the transactionId or null (not allowed).
async function scopedTransactionIdForEmail(emailId: string, scope: ReturnType<typeof getAccessScope>): Promise<string | null> {
  const email = await prisma.outboundEmailQueue.findUnique({
    where: { id: emailId },
    select: { recipientContact: { select: { propertyTransactionId: true } } },
  });
  const txId = email?.recipientContact?.propertyTransactionId;
  if (!txId) return null;
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, txId),
    select: { id: true },
  });
  return tx ? txId : null;
}

// Parked far-future date used to atomically claim a row for immediate send:
// once scheduledFor is out past the drain's `scheduledFor <= now` window, the
// cron can never pick it, so only this action sends it (no double-send).
const PARKED = new Date("2999-12-31T00:00:00.000Z");

export type FileEmailActivityItem = {
  id: string;
  kind: "Chase" | "Notification";
  label: string;        // e.g. "Chase sent" / "Notification sent"
  at: Date;
  deliveryStatus: string;
};

// Recent automated-email activity for one transaction, for the drawer's
// "Activity on this transaction" section. Scoped: returns [] if the caller
// can't see the file.
export async function getFileEmailTimeline(transactionId: string): Promise<FileEmailActivityItem[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];

  const [queueRows, messageRows] = await Promise.all([
    prisma.outboundEmailQueue.findMany({
      where: { sentAt: { not: null }, recipientContact: { propertyTransactionId: transactionId } },
      select: { id: true, emailType: true, sentAt: true, deliveredAt: true, bouncedAt: true, blockedAt: true, errorAt: true },
      orderBy: { sentAt: "desc" },
      take: 8,
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId, channel: "email", purpose: "chase", isAutomated: true, createdByRole: "director", sentAt: { not: null } },
      select: { id: true, sentAt: true, status: true, deliveredAt: true, failedAt: true },
      orderBy: { sentAt: "desc" },
      take: 8,
    }),
  ]);

  const items: FileEmailActivityItem[] = [];
  for (const r of queueRows) {
    const kind = r.emailType === "CLIENT_CHASE" ? "Chase" : "Notification";
    let status = "Sent";
    if (r.errorAt) status = "Errored";
    else if (r.bouncedAt) status = "Bounced";
    else if (r.blockedAt) status = "Blocked";
    else if (r.deliveredAt) status = "Delivered";
    items.push({ id: r.id, kind, label: `${kind} sent`, at: r.sentAt as Date, deliveryStatus: status });
  }
  for (const m of messageRows) {
    let status = "Sent";
    if (m.status === "failed" || m.failedAt) status = "Failed";
    else if (m.status === "bounced") status = "Bounced";
    else if (m.status === "delivered" || m.deliveredAt) status = "Delivered";
    items.push({ id: m.id, kind: "Chase", label: "Chase sent", at: m.sentAt as Date, deliveryStatus: status });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 6);
}

// ── Pending-email controls (race-safe) ──────────────────────────────────────

// Cancel a still-pending email. Atomic compare-and-swap on (sentAt null,
// errorAt null): the drain skips any row with errorAt set, so stamping it here
// removes the row from the send path without a chance of it also sending. If
// the row already sent (or was already cancelled) the updateMany matches 0
// rows and we report that truthfully — no false "cancelled".
export async function cancelPendingEmail(emailId: string): Promise<PendingActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const txId = await scopedTransactionIdForEmail(emailId, scope);
  if (!txId) return { ok: false, error: "You don't have permission to change this email." };

  const who = session.user.name || session.user.email || "an agent";
  const res = await prisma.outboundEmailQueue.updateMany({
    where: { id: emailId, sentAt: null, errorAt: null },
    data: { errorAt: new Date(), errorMessage: `Cancelled by ${who}` },
  });
  if (res.count === 0) return { ok: false, error: "This email has already been sent or cancelled." };
  revalidatePath("/agent/automated-emails");
  return { ok: true, message: "Email cancelled" };
}

// Send a still-pending email immediately. Race-safe: we first PARK the row
// (push scheduledFor past the drain's window) via a compare-and-swap on
// (sentAt null, errorAt null). If that claims the row (count === 1) the cron
// can no longer pick it, so we alone send it — reusing the SAME suppression /
// dead-round / send / mirror path the drain uses. Kept deliberately in step
// with drainOutboundQueue in lib/email/outboundQueue.ts.
export async function sendPendingEmailNow(emailId: string): Promise<PendingActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const txId = await scopedTransactionIdForEmail(emailId, scope);
  if (!txId) return { ok: false, error: "You don't have permission to send this email." };

  // Atomic claim.
  const claim = await prisma.outboundEmailQueue.updateMany({
    where: { id: emailId, sentAt: null, errorAt: null },
    data: { scheduledFor: PARKED },
  });
  if (claim.count === 0) return { ok: false, error: "This email has already been sent or cancelled." };

  const record = await prisma.outboundEmailQueue.findUnique({ where: { id: emailId } });
  if (!record) return { ok: false, error: "Email not found." };

  // Suppression (unsubscribed) — mirror the drain: mark sent + reason, no send.
  let suppressed = false;
  if (record.recipientUserId) suppressed = await isUserEmailSuppressed(record.recipientUserId);
  else if (record.recipientContactId) suppressed = await isContactEmailSuppressed(record.recipientContactId);
  else {
    await prisma.outboundEmailQueue.update({ where: { id: emailId }, data: { errorAt: new Date(), errorMessage: "no_recipient_columns_set" } });
    return { ok: false, error: "This email has no recipient and can't be sent." };
  }
  if (suppressed) {
    await prisma.outboundEmailQueue.update({ where: { id: emailId }, data: { sentAt: new Date(), errorMessage: "suppressed:unsubscribed" } });
    revalidatePath("/agent/automated-emails");
    return { ok: false, error: "The recipient has unsubscribed, so nothing was sent." };
  }

  // Dead-round gate — mirror the drain: a purchaser contact from an archived
  // round must not be emailed.
  let recipientContact: { roleType: string; buyerRoundId: string | null; transaction: { activeBuyerRoundId: string | null } } | null = null;
  if (record.recipientContactId) {
    recipientContact = await prisma.contact.findUnique({
      where: { id: record.recipientContactId },
      select: { roleType: true, buyerRoundId: true, transaction: { select: { activeBuyerRoundId: true } } },
    });
    if (recipientContact && recipientContact.roleType === "purchaser" && recipientContact.buyerRoundId !== null && recipientContact.buyerRoundId !== recipientContact.transaction.activeBuyerRoundId) {
      await prisma.outboundEmailQueue.update({ where: { id: emailId }, data: { errorAt: new Date(), errorMessage: "recipient_round_archived" } });
      return { ok: false, error: "This recipient is from a previous sale, so nothing was sent." };
    }
  }

  const payload = record.payload as Record<string, unknown>;
  try {
    await sendChainEmail({
      to: record.recipientEmail,
      subject: payload.subject as string,
      text: payload.text as string,
      html: payload.html as string | undefined,
      queueId: record.id,
      from: typeof payload.from === "string" ? payload.from : undefined,
      replyTo: typeof payload.replyTo === "string" ? payload.replyTo : undefined,
    });
    const sentAtNow = new Date();
    await prisma.outboundEmailQueue.update({ where: { id: emailId }, data: { sentAt: sentAtNow } });

    // Activity-timeline mirror for client chases (parity with the drain).
    if (record.emailType === "CLIENT_CHASE" && record.recipientContactId && recipientContact) {
      const transactionId = record.sourceId.split(":")[0];
      const stampRoundId = recipientContact.roleType === "purchaser" ? recipientContact.buyerRoundId : null;
      if (transactionId) {
        await prisma.outboundMessage.create({
          data: {
            transactionId, type: "outbound", channel: "email", purpose: "chase", method: "email", status: "sent",
            contactIds: [record.recipientContactId], recipientEmail: record.recipientEmail,
            subject: payload.subject as string, content: payload.text as string, sentAt: sentAtNow,
            isAutomated: true, visibleToClient: true, createdByRole: "system", buyerRoundId: stampRoundId,
          },
        }).catch(() => {});
      }
    }
    if (record.emailType === "CLIENT_CHASE") {
      await recordEvent({
        type: "chase_sent",
        userId: record.recipientUserId ?? undefined,
        entityType: "OutboundEmailQueue",
        entityId: record.id,
        metadata: { recipientContactId: record.recipientContactId, recipientEmail: record.recipientEmail, sentVia: "send_now" },
      }).catch(() => {});
    }
    revalidatePath("/agent/automated-emails");
    return { ok: true, message: "Email sent" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "send error";
    await prisma.outboundEmailQueue.update({ where: { id: emailId }, data: { errorAt: new Date(), errorMessage: message } });
    revalidatePath("/agent/automated-emails");
    return { ok: false, error: "Sending failed. The email is marked as errored." };
  }
}
