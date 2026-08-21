"use server";

// Portal action: a mortgage buyer taps "Request a call back" on the broker
// card. Token-authenticated (the buyer's own portalToken), no session.
//
// Routing depends on whose broker it is (see lib/services/broker-card.ts):
//   - agent source: email the file's agency agent so they follow up with
//     their own broker. No QuoteRequest (the broker is a BrokerFirm, not a
//     provider we email).
//   - tsp source:   email the broker directly from updates@thesalesprogressor
//     .co.uk (reply-to the buyer, CC ourselves), and log a QuoteRequest so it
//     lands in the Command Centre quotes inbox.
//
// Either way we stamp Contact.brokerCallbackRequestedAt so the card switches
// to its acknowledgment state and a joint co-buyer can't re-request.

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { outwardCode } from "@/lib/utils/address";
import { resolveBroker, resolveBrokerServiceType } from "@/lib/services/broker-card";

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";
const SP_CC = "updates@thesalesprogressor.co.uk";

const POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;
function postcodeFromAddress(address: string): string {
  const m = address.match(POSTCODE_RE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : "";
}

export type BrokerCallbackResult = { ok: true; firmName: string } | { ok: false; error: string };

export async function requestBrokerCallbackAction(token: string): Promise<BrokerCallbackResult> {
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
      brokerFirmId: true,
      brokerFirm: { select: { name: true } },
      purchasePrice: true,
      tenure: true,
      agentUser: { select: { name: true, email: true } },
      assignedUser: { select: { name: true, email: true } },
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
  const contactLine = [
    contact.name,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    `Preferred contact: ${methodWord}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (broker.source === "agent") {
    // Tell the agency agent so they follow up with their own broker.
    const to = tx.agentUser?.email ?? tx.assignedUser?.email ?? null;
    if (to) {
      const text = [
        `${contact.name} has asked to speak with your recommended mortgage broker (${broker.firmName}) about ${tx.propertyAddress}.`,
        ``,
        contactLine,
        ``,
        `They're expecting a call back, so please pass this to ${broker.firmName} or get in touch yourself.`,
      ].join("\n");
      await sendEmail({
        to,
        replyTo: contact.email ?? undefined,
        subject: `Broker call-back requested: ${tx.propertyAddress}`,
        text,
      }).catch(() => {});
    }
  } else {
    // TSP broker: log a QuoteRequest and email the broker directly, CC us.
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
        contactLine,
        ``,
        `This was requested through their Sales Progressor portal. Please get in touch with them directly.`,
      ].join("\n");
      await sendEmail({
        to: broker.brokerEmail,
        from: SP_FROM,
        replyTo: contact.email ?? undefined,
        cc: [SP_CC],
        subject: `Mortgage call-back request: ${tx.propertyAddress}`,
        text,
      }).catch(() => {});
    }
  }

  revalidatePath(`/portal/${token}`, "page");
  return { ok: true, firmName: broker.firmName };
}
