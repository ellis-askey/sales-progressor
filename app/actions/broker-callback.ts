"use server";

// Portal action: a mortgage buyer taps "Request a call back" on the broker
// card. Token-authenticated (the buyer's own portalToken), no session.
//
// Routing depends on whose broker it is (see lib/services/broker-card.ts):
//   - agent source: email the file's agency agent so they follow up with
//     their own broker. No QuoteRequest (the broker is a BrokerFirm, not a
//     provider we email).
//   - tsp source:   email the broker directly from updates@thesalesprogressor
//     .co.uk (reply-to the buyer), and log a QuoteRequest so it lands in the
//     Command Centre quotes inbox.
//
// Disclosure scope (Ellis, 2026-08-21): the email includes the buyer's
// contact details, the property address, the purchase price and the tenure.
// Nothing the client typed for the progressor (deposit, funds, FTB status,
// move info) is ever included. The portal card collects an explicit consent
// tick naming exactly these categories before this action can fire, and the
// server re-checks it.
//
// Delivery (Ellis, 2026-08-21 — "fix that going unnoticed thing"): sends go
// through OutboundEmailQueue instead of a fire-and-forget sendEmail. We
// create the queue row, attempt the send immediately (stamping sentAt on
// success), and on failure leave the row untouched so the hourly drain
// retries it. Bounces come back through the SendGrid webhook onto the same
// row, surface in the automated-emails errored feed, and raise a bell for
// the file's owner (see app/api/webhooks/sendgrid-bounce). The old CC to
// updates@ is dropped — the queue row stores the full body and delivery
// state, which is the copy that matters.
//
// Either way we stamp Contact.brokerCallbackRequestedAt so the card switches
// to its acknowledgment state and a joint co-buyer can't re-request.

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendChainEmail } from "@/lib/email";
import { outwardCode } from "@/lib/utils/address";
import { resolveBroker, resolveBrokerServiceType } from "@/lib/services/broker-card";

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

// Also referenced by name in app/api/webhooks/sendgrid-bounce (bounce bell)
// and readable in the automated-emails feed. Keep the two literals in sync.
const BROKER_CALLBACK_EMAIL_TYPE = "BROKER_CALLBACK";

const POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;
function postcodeFromAddress(address: string): string {
  const m = address.match(POSTCODE_RE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : "";
}

function formatPrice(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function tenureLine(tenure: string | null, isShareOfFreehold: boolean): string | null {
  if (!tenure) return null;
  const word = tenure === "leasehold" ? "Leasehold" : "Freehold";
  return isShareOfFreehold && tenure === "leasehold"
    ? "Leasehold (share of freehold)"
    : word;
}

/**
 * Create the queue row, then try to send straight away so the happy path
 * stays instant. Success stamps sentAt; failure leaves the row for the
 * hourly drain to retry, and a second failure there lands it in the
 * errored feed. Never throws — the buyer's request is already recorded.
 */
async function queueAndSend(args: {
  sourceId: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientContactId?: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  let queueId: string | null = null;
  try {
    const row = await prisma.outboundEmailQueue.create({
      data: {
        emailType: BROKER_CALLBACK_EMAIL_TYPE,
        sourceId: args.sourceId,
        recipientEmail: args.recipientEmail,
        recipientUserId: args.recipientUserId ?? null,
        recipientContactId: args.recipientContactId ?? null,
        payload: {
          subject: args.subject,
          text: args.text,
          ...(args.from ? { from: args.from } : {}),
          ...(args.replyTo ? { replyTo: args.replyTo } : {}),
        },
        scheduledFor: new Date(),
      },
    });
    queueId = row.id;
  } catch (err) {
    // Queue write failed — fall back to a direct tracked-less send rather
    // than dead-ending the buyer's request. This is the pre-queue behaviour
    // and should be vanishingly rare.
    console.error("[broker-callback] queue write failed, sending direct", err);
    await sendChainEmail({
      to: args.recipientEmail,
      subject: args.subject,
      text: args.text,
      from: args.from,
      replyTo: args.replyTo,
      emailType: BROKER_CALLBACK_EMAIL_TYPE,
    }).catch((sendErr) => {
      console.error("[broker-callback] direct fallback send failed", sendErr);
    });
    return;
  }

  try {
    await sendChainEmail({
      to: args.recipientEmail,
      subject: args.subject,
      text: args.text,
      from: args.from,
      replyTo: args.replyTo,
      queueId,
      emailType: BROKER_CALLBACK_EMAIL_TYPE,
    });
    await prisma.outboundEmailQueue.update({
      where: { id: queueId },
      data: { sentAt: new Date() },
    });
  } catch (err) {
    // Leave the row unsent (no errorAt) — the hourly drain retries it.
    console.error(
      `[broker-callback] immediate send failed, queued for drain retry id=${queueId}`,
      err,
    );
  }
}

export type BrokerCallbackResult = { ok: true; firmName: string } | { ok: false; error: string };

export async function requestBrokerCallbackAction(
  token: string,
  consent: boolean,
): Promise<BrokerCallbackResult> {
  // The card disables its CTA until the consent tick is checked; this is the
  // server-side backstop so the disclosure can never fire without it.
  if (!consent) {
    return { ok: false, error: "Please tick the consent box first." };
  }

  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roleType: true,
      propertyTransactionId: true,
      brokerCallbackRequestedAt: true,
      portalSettings: true,
    },
  });
  if (!contact || contact.roleType !== "purchaser") {
    return { ok: false, error: "This isn't available on your file." };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: {
      id: true,
      propertyAddress: true,
      serviceType: true,
      purchaseType: true,
      tenure: true,
      isShareOfFreehold: true,
      brokerFirmId: true,
      brokerFirm: { select: { name: true } },
      purchasePrice: true,
      agentUser: { select: { id: true, name: true, email: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      contacts: { where: { roleType: "purchaser" }, select: { brokerCallbackRequestedAt: true } },
    },
  });
  if (!tx || tx.purchaseType !== "mortgage") {
    return { ok: false, error: "This isn't available on your file." };
  }

  const broker = await resolveBroker(tx);
  if (!broker) return { ok: false, error: "This isn't available on your file." };

  // Idempotent per FILE: if ANY purchaser (this buyer or a joint co-buyer) has
  // already requested, don't send again — just report success so the card
  // shows its acknowledgment. Matches the card's per-file "requested" gating.
  if (tx.contacts.some((c) => c.brokerCallbackRequestedAt != null)) {
    return { ok: true, firmName: broker.firmName };
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: { brokerCallbackRequestedAt: new Date() },
  });

  const settings = (contact.portalSettings ?? null) as { whatsappOptIn?: boolean } | null;
  const methodWord = settings?.whatsappOptIn ? "WhatsApp" : "phone or email";
  const tenure = tenureLine(tx.tenure, tx.isShareOfFreehold);
  const detailBlock = [
    contact.name,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    `Preferred contact: ${methodWord}`,
    ``,
    `Property: ${tx.propertyAddress}`,
    tx.purchasePrice != null ? `Purchase price: ${formatPrice(tx.purchasePrice)}` : null,
    tenure ? `Tenure: ${tenure}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  if (broker.source === "agent") {
    // Tell the agency agent so they follow up with their own broker.
    const recipient = tx.agentUser ?? tx.assignedUser;
    if (recipient?.email) {
      const text = [
        `${contact.name} has asked to speak with your recommended mortgage broker (${broker.firmName}) about ${tx.propertyAddress}.`,
        ``,
        detailBlock,
        ``,
        `They're expecting a call back, so please pass this to ${broker.firmName} or get in touch yourself.`,
      ].join("\n");
      await queueAndSend({
        sourceId: `${tx.id}:broker-callback`,
        recipientEmail: recipient.email,
        recipientUserId: recipient.id,
        replyTo: contact.email ?? undefined,
        subject: `Broker call-back requested: ${tx.propertyAddress}`,
        text,
      });
    }
  } else {
    // TSP broker: log a QuoteRequest and email the broker directly.
    try {
      const serviceType = await resolveBrokerServiceType();
      const postcode = postcodeFromAddress(tx.propertyAddress);
      await prisma.quoteRequest.create({
        data: {
          transactionId: tx.id,
          contactId: contact.id,
          providerId: broker.providerId!,
          serviceTypeId: serviceType.id,
          kind: "mortgage_broker",
          contactMethod: settings?.whatsappOptIn ? "whatsapp" : "either",
          contactWindow: "anytime",
          urgency: "flexible",
          clientName: contact.name,
          clientEmail: (contact.email ?? "").toLowerCase(),
          clientPhone: contact.phone ?? null,
          propertyAddress: tx.propertyAddress,
          propertyPostcode: postcode,
          propertyOutwardCode: outwardCode(postcode) ?? "",
          pricePence: tx.purchasePrice ?? null,
          tenure: tx.tenure ?? null,
          submittedAt: new Date(),
        },
      });
    } catch {
      // A logging failure must not dead-end the buyer; the email below is the
      // one that matters for the callback.
    }

    if (broker.brokerEmail) {
      const text = [
        `${contact.name} has requested a call back about their mortgage for ${tx.propertyAddress}.`,
        ``,
        detailBlock,
        ``,
        `This was requested through their Sales Progressor portal, and they've agreed to these details being shared with you. Please get in touch with them directly.`,
      ].join("\n");
      await queueAndSend({
        sourceId: `${tx.id}:broker-callback`,
        recipientEmail: broker.brokerEmail,
        recipientContactId: contact.id,
        from: SP_FROM,
        replyTo: contact.email ?? undefined,
        subject: `Mortgage call-back request: ${tx.propertyAddress}`,
        text,
      });
    }
  }

  revalidatePath(`/portal/${token}`, "page");
  return { ok: true, firmName: broker.firmName };
}
