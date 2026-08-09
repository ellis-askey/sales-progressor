"use server";

// Public quote-request submission action. Called from /quote/[token] by a
// client with a valid Contact.portalToken. Creates one QuoteRequest per
// selected firm, sends one email per row, logs each to OutboundEmailQueue.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { outwardCode } from "@/lib/utils/address";
import type { QuoteContactMethod, QuoteContactWindow, QuoteUrgency } from "@prisma/client";

// UK postcode inside a free-form address string.
const POSTCODE_IN_ADDRESS = /\b([A-Z]{1,2}[0-9][0-9A-Z]?)\s*([0-9][A-Z]{2})\b/i;

function extractPostcodeFromAddress(address: string): string {
  const match = address.match(POSTCODE_IN_ADDRESS);
  if (!match) return "";
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

export type QuoteSubmitInput = {
  token: string;
  serviceTypeId: string;
  providerIds: string[];
  contactMethod: QuoteContactMethod;
  contactWindow: QuoteContactWindow;
  urgency: QuoteUrgency;
  notes: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
};

export type QuoteSubmitResult =
  | { ok: true; count: number; firmNames: string[] }
  | { ok: false; error: string };

const FALLBACK_CC = "ellis@thesalesprogressor.co.uk";

export async function submitQuoteRequest(input: QuoteSubmitInput): Promise<QuoteSubmitResult> {
  if (!input.token) return { ok: false, error: "Missing session." };
  if (!input.serviceTypeId) return { ok: false, error: "Please pick a service type." };
  if (input.providerIds.length === 0) return { ok: false, error: "Please pick at least one firm." };
  if (!input.clientName.trim()) return { ok: false, error: "Name is required." };
  if (!input.clientEmail.trim()) return { ok: false, error: "Email is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.clientEmail.trim())) {
    return { ok: false, error: "That email doesn't look valid." };
  }

  // 1. Look up the contact + linked sale from the token.
  const contact = await prisma.contact.findFirst({
    where: { portalToken: input.token },
    include: {
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          assignedUser: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!contact) return { ok: false, error: "That link isn't valid. Please contact your agent." };

  // 2. Look up the service type + firms; verify each firm covers the postcode
  //    and offers this service type. Prevents client-side tampering.
  const [serviceType, firms] = await Promise.all([
    prisma.providerServiceType.findUnique({
      where: { id: input.serviceTypeId },
    }),
    prisma.providerFirm.findMany({
      where: {
        id: { in: input.providerIds },
        active: true,
      },
      include: {
        coverage: true,
        serviceTypes: true,
      },
    }),
  ]);

  if (!serviceType || !serviceType.active) {
    return { ok: false, error: "That service type is no longer available." };
  }

  const outward = outwardCode(contact.transaction.propertyAddress);
  if (!outward) {
    return { ok: false, error: "We couldn't read the postcode for your sale. Please contact your agent." };
  }

  const validFirms = firms.filter(
    (f) =>
      f.coverage.some((c) => c.outwardCode === outward) &&
      f.serviceTypes.some((s) => s.serviceTypeId === serviceType.id),
  );

  if (validFirms.length === 0) {
    return { ok: false, error: "None of the selected firms cover your area for that service." };
  }

  // 3. Create one QuoteRequest per valid firm.
  const propertyAddress = contact.transaction.propertyAddress;
  const propertyPostcode = extractPostcodeFromAddress(propertyAddress);
  const agentEmail = contact.transaction.assignedUser?.email ?? null;

  const created = await Promise.all(
    validFirms.map((f) =>
      prisma.quoteRequest.create({
        data: {
          transactionId: contact.transaction.id,
          contactId: contact.id,
          providerId: f.id,
          serviceTypeId: serviceType.id,
          kind: f.kind,
          contactMethod: input.contactMethod,
          contactWindow: input.contactWindow,
          urgency: input.urgency,
          notes: input.notes.trim() || null,
          clientName: input.clientName.trim(),
          clientEmail: input.clientEmail.trim().toLowerCase(),
          clientPhone: input.clientPhone.trim() || null,
          propertyAddress,
          propertyPostcode,
          propertyOutwardCode: outward,
          submittedAt: new Date(),
        },
      }),
    ),
  );

  // 4. Send one email per QuoteRequest. Log to OutboundEmailQueue for
  //    delivery-status tracking (SendGrid webhooks fill in
  //    deliveredAt/bouncedAt via queueId customArgs).
  await Promise.all(
    created.map(async (q, idx) => {
      const firm = validFirms[idx];
      const cc: string[] = [];
      if (agentEmail) cc.push(agentEmail);
      cc.push(FALLBACK_CC);
      // Dedupe in case the agent IS ellis
      const dedupedCc = [...new Set(cc)];

      const subject = `Survey quote request — ${propertyAddress}`;
      const text = renderQuoteEmailText({
        firmName: firm.name,
        serviceLabel: serviceType.label,
        propertyAddress,
        propertyPostcode,
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail.trim(),
        clientPhone: input.clientPhone.trim() || "(not provided)",
        contactMethod: input.contactMethod,
        contactWindow: input.contactWindow,
        urgency: input.urgency,
        notes: input.notes.trim() || "(none)",
      });

      // Create the OutboundEmailQueue row first (so we have a queueId for
      // SendGrid customArgs). Marked sentAt immediately since we're sending
      // inline rather than via the drain cron.
      const queueRow = await prisma.outboundEmailQueue.create({
        data: {
          emailType: "PROVIDER_QUOTE",
          sourceId: `quote:${q.id}`,
          recipientEmail: firm.email,
          payload: { subject, text },
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      });

      try {
        await sendEmail({
          to: firm.email,
          cc: dedupedCc,
          replyTo: input.clientEmail.trim(),
          subject,
          text,
          queueId: queueRow.id,
        });
        await prisma.quoteRequest.update({
          where: { id: q.id },
          data: { emailSentAt: new Date(), emailMessageId: queueRow.id },
        });
      } catch (err) {
        // Stamp the error on the queue row so it surfaces in the CC detail view.
        await prisma.outboundEmailQueue.update({
          where: { id: queueRow.id },
          data: {
            errorAt: new Date(),
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        // Don't fail the whole submission — the QuoteRequest row still exists
        // and admin can see the delivery failure in the CC.
      }
    }),
  );

  return {
    ok: true,
    count: created.length,
    firmNames: validFirms.map((f) => f.name),
  };
}

function renderQuoteEmailText(v: {
  firmName: string;
  serviceLabel: string;
  propertyAddress: string;
  propertyPostcode: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  contactMethod: string;
  contactWindow: string;
  urgency: string;
  notes: string;
}): string {
  const urgency =
    v.urgency === "asap"
      ? "As soon as possible"
      : v.urgency === "within_week"
        ? "Within a week"
        : "Flexible";
  const window =
    v.contactWindow === "anytime"
      ? "Anytime"
      : v.contactWindow === "morning"
        ? "Morning"
        : v.contactWindow === "afternoon"
          ? "Afternoon"
          : "Evening";
  const method =
    v.contactMethod === "phone"
      ? "By phone"
      : v.contactMethod === "email"
        ? "By email"
        : "Phone or email, whichever works";

  return `Hi ${v.firmName},

A client of ours has requested a quote for the following:

Property:      ${v.propertyAddress}
Postcode:      ${v.propertyPostcode}
Service:       ${v.serviceLabel}
Urgency:       ${urgency}

Client contact:
  Name:        ${v.clientName}
  Email:       ${v.clientEmail}
  Phone:       ${v.clientPhone}
  Reach them:  ${method}
  Best time:   ${window}

Client's notes:
${v.notes}

Please reply directly to ${v.clientEmail} with your quote.

Thanks,
Sales Progressor
`;
}
