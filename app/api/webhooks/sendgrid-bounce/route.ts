// POST /api/webhooks/sendgrid-bounce
//
// SendGrid Event Webhook receiver. Route name is historical (pre-2026-05-29
// it only handled bounces); it now processes the full delivery-tracking
// event set: delivered / deferred / bounce / blocked / dropped.
//
// Two responsibilities:
//   1. Update OutboundEmailQueue rows with delivery status (deliveredAt /
//      deferredAt / bouncedAt / blockedAt + reasons + deferredCount) so
//      the UI shows what actually happened, not just what we handed to
//      SendGrid. Joins events to rows via customArgs.queueId set in
//      lib/email.ts:sendEmail/sendChainEmail.
//   2. Hard-bounce side effects on chain invite / operational emails —
//      handleBouncedInvite + global user suppression. Existing behaviour
//      preserved verbatim so nothing currently relying on this changes.
//
// Configure in SendGrid: Settings → Mail Settings → Event Webhook.
// Endpoint URL: https://portal.thesalesprogressor.co.uk/api/webhooks/sendgrid-bounce
// Enabled events: delivered, deferred, bounce, blocked, dropped.
// Signed Event Webhook: enabled. Public key in env as
// SENDGRID_WEBHOOK_PUBLIC_KEY.

import { type NextRequest, NextResponse } from "next/server";
import { createPublicKey, createVerify } from "node:crypto";
import { handleBouncedInvite } from "@/lib/chain/invite";
import { prisma } from "@/lib/prisma";
import {
  classifyEvent,
  extractQueueIds,
  type QueueUpdate,
  type SendGridEvent,
} from "@/lib/email/sendgrid-webhook";

const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

// Returns true when the signature is valid for (timestamp + raw body) under
// the SendGrid Signed Event Webhook public key. Returns false on any
// failure — malformed inputs, missing env var, crypto exceptions. Callers
// should treat false as unauthorized.
//
// SendGrid signs with ECDSA-P256 over the SHA-256 of (timestamp || body).
// The public key in the dashboard is base64-encoded DER (SubjectPublicKeyInfo).
function verifySignature(rawBody: string, signature: string, timestamp: string): boolean {
  const publicKeyB64 = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyB64 || !signature || !timestamp) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    const verifier = createVerify("sha256");
    verifier.update(timestamp + rawBody);
    verifier.end();
    return verifier.verify(publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Read the raw body once — we need it for both signature verification and
  // JSON parsing. NextRequest.text() returns the raw string before parsing.
  const rawBody = await req.text();

  // HMAC gate. Skipped when SENDGRID_WEBHOOK_PUBLIC_KEY isn't set so local
  // dev / one-off test posts still work; required in any env that has the
  // key configured. Production should always have it set.
  if (process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) {
    const signature = req.headers.get(SIGNATURE_HEADER) ?? "";
    const timestamp = req.headers.get(TIMESTAMP_HEADER) ?? "";
    if (!verifySignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
  }

  let events: SendGridEvent[];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let updated = 0;
  let bounceSideEffects = 0;

  for (const event of events) {
    // (1) Delivery-status writes — every event maps to at most one
    // QueueUpdate (or null for ignored events). Each event fans out to
    // every queue row id in customArgs.queueId (digest mode passes a
    // comma-joined list).
    const update = classifyEvent(event);
    if (update) {
      const queueIds = extractQueueIds(event);
      if (queueIds.length > 0) {
        try {
          updated += await applyUpdate(queueIds, update);
        } catch (err) {
          console.error("[sendgrid-webhook] update failed", err);
        }
        // Broker call-back bounce bell (Ellis, 2026-08-21): a buyer who
        // requested a call is now waiting on an email that died. Tell the
        // file's owner so they can pass the request on by hand instead of
        // the client silently hearing nothing.
        if (update.kind === "bounced" || update.kind === "blocked") {
          await notifyBrokerCallbackFailure(queueIds).catch((err) =>
            console.error("[sendgrid-webhook] broker-callback bell failed", err),
          );
        }
      }
    }

    // (2) Existing bounce side-effects — preserved as-is. Hard bounces on
    // chain invites trigger invite-bounced notifications; bounces on
    // operational user emails suppress the user globally so we stop
    // sending to a dead address.
    const isHardBounce =
      (event.event === "bounce" && event.type !== "blocked") || event.event === "dropped";
    if (isHardBounce && typeof event.email === "string") {
      await handleBouncedInvite(event.email).catch(console.error);
      await suppressUserByEmail(event.email).catch(console.error);
      bounceSideEffects++;
    }
  }

  return NextResponse.json({ ok: true, eventsProcessed: events.length, updated, bounceSideEffects });
}

// Apply a single classified update to N queue rows. Returns the number of
// rows actually updated (the unique ids may not all match — e.g. a queue
// row was deleted between send and event).
async function applyUpdate(queueIds: string[], update: QueueUpdate): Promise<number> {
  switch (update.kind) {
    case "delivered": {
      const res = await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: queueIds } },
        data: { deliveredAt: update.deliveredAt },
      });
      return res.count;
    }
    case "deferred": {
      // Increment deferredCount on every matching row, stamp deferredAt
      // + reason. updateMany doesn't support per-row increments
      // alongside a where-in, so we do it via raw SQL for a single
      // round-trip. Falls back to a loop on any unexpected error.
      try {
        const ids = queueIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
        await prisma.$executeRawUnsafe(
          `UPDATE "OutboundEmailQueue" SET "deferredAt" = $1, "deferredReason" = $2, "deferredCount" = "deferredCount" + 1 WHERE "id" IN (${ids})`,
          update.deferredAt,
          update.deferredReason,
        );
        return queueIds.length;
      } catch {
        let count = 0;
        for (const id of queueIds) {
          try {
            await prisma.outboundEmailQueue.update({
              where: { id },
              data: {
                deferredAt: update.deferredAt,
                deferredReason: update.deferredReason,
                deferredCount: { increment: 1 },
              },
            });
            count++;
          } catch {
            // row vanished — ignore
          }
        }
        return count;
      }
    }
    case "bounced": {
      const res = await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: queueIds } },
        data: { bouncedAt: update.bouncedAt, bouncedReason: update.bouncedReason },
      });
      return res.count;
    }
    case "blocked": {
      const res = await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: queueIds } },
        data: { blockedAt: update.blockedAt, blockedReason: update.blockedReason },
      });
      return res.count;
    }
  }
}

// Hard bounce on an operational email — suppress the account globally.
// Sets emailUnsubscribedAt if the user exists and hasn't already opted out.
async function suppressUserByEmail(email: string): Promise<void> {
  await prisma.user.updateMany({
    where: { email, emailUnsubscribedAt: null },
    data: { emailUnsubscribedAt: new Date() },
  });
}

// A bounced/blocked BROKER_CALLBACK send means a buyer is waiting for a call
// that will never come. Bell the file's assigned progressor (falling back to
// the agent) so a human passes the request on. sourceId format from
// app/actions/broker-callback.ts is `{transactionId}:broker-callback`.
async function notifyBrokerCallbackFailure(queueIds: string[]): Promise<void> {
  const rows = await prisma.outboundEmailQueue.findMany({
    where: { id: { in: queueIds }, emailType: "BROKER_CALLBACK" },
    select: { id: true, sourceId: true, recipientEmail: true },
  });
  for (const row of rows) {
    const transactionId = row.sourceId.split(":")[0];
    if (!transactionId) continue;
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: {
        propertyAddress: true,
        assignedUserId: true,
        agentUserId: true,
      },
    });
    const userId = tx?.assignedUserId ?? tx?.agentUserId;
    if (!tx || !userId) continue;
    await prisma.notification.create({
      data: {
        userId,
        type: "broker_callback_bounced",
        transactionId,
        payload: {
          recipientEmail: row.recipientEmail,
          propertyAddress: tx.propertyAddress,
          title: "Broker call-back email didn't arrive",
          body: `The call-back request for ${tx.propertyAddress} couldn't be delivered to ${row.recipientEmail}. The buyer is expecting a call, so please pass it on another way.`,
        },
      },
    });
  }
}
