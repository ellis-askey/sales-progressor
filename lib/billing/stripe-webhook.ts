// lib/billing/stripe-webhook.ts
//
// Stripe webhook event-processing logic. Separated from the HTTP route
// handler (app/api/webhooks/stripe) so the verifier can exercise event
// processing with fake constructed events — no Stripe signing required
// for unit verification. The route handler does signature verification
// + raw body parsing, then delegates here.
//
// PR 7 handles two event types:
//   - invoice.payment_succeeded:
//       Mark Invoice.status = "paid", Invoice.paidAt = event timestamp.
//       Clear Agency.paymentFailedAt + newFileCreationBlockedAt — agency
//       is now in good standing.
//   - invoice.payment_failed:
//       Set Agency.paymentFailedAt = event timestamp IF not already set.
//       Don't reset the clock on retries — the 7-day grace window starts
//       from the FIRST failure, not the most recent one. Stripe handles
//       the retry schedule itself.
//
// Lookup: we match Stripe invoices to our Invoice rows via stripeInvoiceId
// (populated by lib/billing/issuance.ts at issuance time). If we receive a
// webhook for an invoice we don't recognise, log and ignore — could be a
// Stripe-side test event or an invoice from a deleted record.
//
// Idempotent: Stripe may deliver the same event multiple times. We use
// updateMany with state guards in the WHERE clause so re-processing the
// same event yields the same final state.

import { prisma } from "@/lib/prisma";

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number; // seconds since epoch
  data: {
    object: {
      id: string;
      // additional fields per event type
      [key: string]: unknown;
    };
  };
};

export type ProcessResult =
  | { handled: false; reason: string }
  | { handled: true; action: "marked_paid" | "marked_failed" | "noop_invoice_not_found" | "noop_already_in_state" };

export async function processStripeEvent(event: StripeWebhookEvent): Promise<ProcessResult> {
  switch (event.type) {
    case "invoice.payment_succeeded":
      return handleInvoicePaymentSucceeded(event);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event);
    default:
      return { handled: false, reason: `unhandled event type: ${event.type}` };
  }
}

async function handleInvoicePaymentSucceeded(event: StripeWebhookEvent): Promise<ProcessResult> {
  const stripeInvoiceId = event.data.object.id;
  const eventTimestamp = new Date(event.created * 1000);

  const invoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId },
    select: { id: true, agencyId: true, status: true },
  });
  if (!invoice) return { handled: true, action: "noop_invoice_not_found" };

  await prisma.$transaction(async (tx) => {
    // Mark invoice paid — guarded so re-delivery doesn't churn the timestamp.
    await tx.invoice.updateMany({
      where: { id: invoice.id, status: { not: "paid" } },
      data: { status: "paid", paidAt: eventTimestamp },
    });
    // Clear block flags on the agency — they're now in good standing.
    await tx.agency.updateMany({
      where: { id: invoice.agencyId },
      data: { paymentFailedAt: null, newFileCreationBlockedAt: null },
    });
  });
  return { handled: true, action: "marked_paid" };
}

async function handleInvoicePaymentFailed(event: StripeWebhookEvent): Promise<ProcessResult> {
  const stripeInvoiceId = event.data.object.id;
  const eventTimestamp = new Date(event.created * 1000);

  const invoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId },
    select: { id: true, agencyId: true, status: true },
  });
  if (!invoice) return { handled: true, action: "noop_invoice_not_found" };

  await prisma.$transaction(async (tx) => {
    // Status flip: building/issued → failed (only if not already paid).
    // Don't move "paid" backwards — defensive against out-of-order webhook
    // delivery in pathological cases.
    await tx.invoice.updateMany({
      where: { id: invoice.id, status: { in: ["building", "issued", "failed"] } },
      data: { status: "failed" },
    });
    // Set paymentFailedAt ONLY if not already set — the 7-day grace
    // window starts at the first failure, not the most recent retry.
    // updateMany with `paymentFailedAt: null` in WHERE makes this atomic
    // even under concurrent webhook delivery.
    await tx.agency.updateMany({
      where: { id: invoice.agencyId, paymentFailedAt: null },
      data: { paymentFailedAt: eventTimestamp },
    });
  });
  return { handled: true, action: "marked_failed" };
}
