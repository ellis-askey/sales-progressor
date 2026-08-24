"use server";

// Public quote-request submission action. Called from /quote/[token] by a
// client with a valid Contact.portalToken. Creates one QuoteRequest per
// selected firm, sends one email per row, logs each to OutboundEmailQueue.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { outwardCode } from "@/lib/utils/address";
import type { QuoteContactMethod, QuoteContactWindow, QuoteUrgency, Tenure } from "@prisma/client";

// Contact methods that reach the client on a phone number — server-side mirror
// of the client's PHONE_METHODS gate.
const PHONE_METHODS: QuoteContactMethod[] = ["phone", "text", "whatsapp"];

function tenureLabel(tenure: Tenure | null, isShareOfFreehold: boolean): string | null {
  if (isShareOfFreehold) return "Share of freehold";
  if (tenure === "freehold") return "Freehold";
  if (tenure === "leasehold") return "Leasehold";
  return null;
}

function priceLabel(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

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
  | {
      ok: true;
      count: number;
      firmNames: string[];
      // Full firm details for the success receipt (2026-08-19 card
      // rebuild) — the card shows surveyors with logos + blurbs, not
      // bare names. firmNames retained for back-compat.
      firms: Array<{ id: string; name: string; logoUrl: string | null; notes: string | null }>;
    }
  | { ok: false; error: string };

// Where quotes send from when an agency has no verified sender on file, and
// where the internal "a quote was requested" heads-up lands.
// Internal ops inbox for the "a quote was requested" heads-up (a recipient, not
// a sender fallback).
const SP_OPS_INBOX = "ellis@thesalesprogressor.co.uk";
const SP_NOTIFY_FROM = "updates@thesalesprogressor.co.uk";

const LEGAL_SUFFIX = /\s+(Ltd|Limited|LLP|PLC|plc)\.?$/i;

// Build a "Display Name <address>" From header, quoting the display name if it
// contains characters that would break the header.
function buildFrom(display: string, address: string): string {
  const safe = /[,;@<>()[\]\\"]/.test(display) ? `"${display.replace(/"/g, '\\"')}"` : display;
  return `${safe} <${address}>`;
}

export async function submitQuoteRequest(input: QuoteSubmitInput): Promise<QuoteSubmitResult> {
  if (!input.token) return { ok: false, error: "Missing session." };
  if (!input.serviceTypeId) return { ok: false, error: "Please pick a service type." };
  if (input.providerIds.length === 0) return { ok: false, error: "Please pick at least one firm." };
  if (!input.clientName.trim()) return { ok: false, error: "Name is required." };
  if (!input.clientEmail.trim()) return { ok: false, error: "Email is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.clientEmail.trim())) {
    return { ok: false, error: "That email doesn't look valid." };
  }
  if (PHONE_METHODS.includes(input.contactMethod) && !input.clientPhone.trim()) {
    return { ok: false, error: "Add a phone number so they can reach you that way." };
  }

  // 1. Look up the contact + linked sale from the token. Pull the property
  //    facts a surveyor needs to price the job (price + tenure) server-side so
  //    they can't be tampered with.
  const contact = await prisma.contact.findFirst({
    where: { portalToken: input.token },
    include: {
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          purchasePrice: true,
          tenure: true,
          isShareOfFreehold: true,
          agency: { select: { name: true, quoteSenderEmail: true } },
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
      // Mortgage brokers work nationwide (no coverage rows); everyone else must
      // cover the property's outward code.
      (f.kind === "mortgage_broker" || f.coverage.some((c) => c.outwardCode === outward)) &&
      f.serviceTypes.some((s) => s.serviceTypeId === serviceType.id),
  );

  if (validFirms.length === 0) {
    return { ok: false, error: "None of the selected firms cover your area for that service." };
  }

  // 3. Create one QuoteRequest per valid firm.
  const propertyAddress = contact.transaction.propertyAddress;
  const propertyPostcode = extractPostcodeFromAddress(propertyAddress);
  // Send the quote FROM the agency's own verified address (e.g.
  // ellis@akeman-residential for an Akeman sale). No verified sender on file
  // (e.g. EXP) → the file-type-aware fallback (outsourced = the progressor's
  // @thesalesprogressor.co.uk address; in-house = updates@).
  const agencyName = (contact.transaction.agency?.name ?? "Sales Progressor").replace(LEGAL_SUFFIX, "").trim();
  const senderAddress = contact.transaction.agency?.quoteSenderEmail
    ?? (await resolveAgencySenderForTransaction(contact.transaction.id)).replyTo;
  const quoteFrom = buildFrom(agencyName, senderAddress);
  const pricePence = contact.transaction.purchasePrice ?? null;
  const tenure = contact.transaction.tenure ?? null;
  const tenureText = tenureLabel(tenure, contact.transaction.isShareOfFreehold);
  const priceText = priceLabel(pricePence);

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
          pricePence,
          tenure,
          submittedAt: new Date(),
        },
      }),
    ),
  );

  // 4. Send one email per QuoteRequest. Log to OutboundEmailQueue for
  //    delivery-status tracking (SendGrid webhooks fill in
  //    deliveredAt/bouncedAt via queueId customArgs).
  //
  //    The ENTIRE per-firm block is wrapped so nothing here — not the queue
  //    insert, not the send, not the status update — can ever throw out of the
  //    action and crash the client's submission. The QuoteRequest rows are
  //    already saved above; a mail failure is an admin-side concern, surfaced
  //    via the queue row's error stamp, not a dead-end for the buyer.
  //    (Fixes the 2026-08-14 crash: the queue insert used to sit outside the
  //    try, so any failure there rejected the whole submit.)
  await Promise.all(
    created.map(async (q, idx) => {
      try {
        const firm = validFirms[idx];

        const subject = `Survey quote request: ${propertyAddress}`;
        const text = renderQuoteEmailText({
          firmName: firm.name,
          serviceLabel: serviceType.label,
          propertyAddress,
          propertyPostcode,
          priceText: priceText ?? "(not recorded)",
          tenureText: tenureText ?? "(not recorded)",
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
            from: quoteFrom,
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
        }
      } catch {
        // Last-resort guard: even a queue-insert failure must not crash the
        // submit. The QuoteRequest row persists; admin sees no emailSentAt.
      }
    }),
  );

  // 5. Internal heads-up. One simple email per submission to Sales Progressor
  //    so a quote request never goes unnoticed; the full detail lives in the
  //    Command Centre quote inbox. Wrapped so it can never crash the submit.
  try {
    const base = process.env.NEXTAUTH_URL ?? "";
    const firmList = validFirms.map((f) => f.name).join(", ");
    const notifyText = [
      `A survey quote has been requested.`,
      ``,
      `Agency:     ${agencyName}`,
      `Property:   ${propertyAddress}`,
      `Survey:     ${serviceType.label}`,
      `Surveyor${validFirms.length === 1 ? "" : "s"}:  ${firmList}`,
      `Client:     ${input.clientName.trim()}`,
      ``,
      `Full details are in the Command Centre:`,
      `${base}/command/providers/quotes`,
    ].join("\n");

    await sendEmail({
      to: SP_OPS_INBOX,
      from: buildFrom(`Ellis @ ${agencyName}`, SP_NOTIFY_FROM),
      subject: `Survey quote requested: ${serviceType.label}`,
      text: notifyText,
    });
  } catch {
    // Non-critical: the QuoteRequest rows + the Command Centre are the record.
  }

  return {
    ok: true,
    count: created.length,
    firmNames: validFirms.map((f) => f.name),
    firms: validFirms.map((f) => ({ id: f.id, name: f.name, logoUrl: getProviderLogoUrl(f.logoPath), notes: f.notes ?? null })),
  };
}

function renderQuoteEmailText(v: {
  firmName: string;
  serviceLabel: string;
  propertyAddress: string;
  propertyPostcode: string;
  priceText: string;
  tenureText: string;
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
        : v.contactMethod === "text"
          ? "By text message"
          : v.contactMethod === "whatsapp"
            ? "By WhatsApp"
            : "Phone or email, whichever works";

  return `Hi ${v.firmName},

A client of ours has requested a quote for the following:

Property:      ${v.propertyAddress}
Postcode:      ${v.propertyPostcode}
Price:         ${v.priceText}
Tenure:        ${v.tenureText}
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
