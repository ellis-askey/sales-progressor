// lib/billing/issuance.ts
//
// Month-end issuance: for each building Invoice from the closed prior
// London month, create a corresponding Stripe Invoice (with InvoiceItems
// matching our InvoiceLine rows), trigger automatic collection, and flip
// our Invoice.status from "building" → "issued" with the Stripe invoice id
// persisted on the row.
//
// Stripe handles the actual charging via Customer.invoice_settings.
// default_payment_method (set when card capture completed in PR 6). On
// success or failure, Stripe sends invoice.payment_succeeded /
// invoice.payment_failed webhooks that lib/billing/stripe-webhook.ts
// translates back to our Invoice + Agency state.
//
// Idempotent: if our Invoice.stripeInvoiceId is already set, we don't
// re-issue. If we crash mid-flight after creating the Stripe Invoice but
// before persisting the id, the Stripe Invoice will be re-created on the
// next run (orphan) — acceptable for a low-frequency monthly cron, and
// Stripe duplicate invoices are visible in the dashboard.
//
// The Stripe interaction is via the StripeIssuer interface below so the
// verifier can pass a fake (the real fan-out happens browser-side / via
// Stripe test mode in the consolidated walk).

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { billingMonthStart } from "@/lib/billing/period";

export type StripeIssuer = (input: {
  customerId: string;
  agencyId: string;
  monthStart: Date;
  lines: { description: string; amountPence: number }[];
}) => Promise<{ stripeInvoiceId: string }>;

const realStripeIssuer: StripeIssuer = async ({ customerId, agencyId, monthStart, lines }) => {
  const stripe = getStripeClient();

  // One InvoiceItem per line — attached to the customer, not yet on an invoice.
  // The subsequent invoice.create({ customer }) sweeps all pending items.
  for (const line of lines) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: line.amountPence,
      currency: "gbp",
      description: line.description,
      metadata: { agencyId, monthStart: monthStart.toISOString() },
    });
  }

  // collection_method=charge_automatically uses the default payment method.
  // auto_advance=true tells Stripe to finalize + attempt collection right away.
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    auto_advance: true,
    metadata: { agencyId, monthStart: monthStart.toISOString() },
  });

  return { stripeInvoiceId: invoice.id! };
};

/**
 * Issue all building invoices from the closed prior London month.
 * Returns counts for the cron's response payload.
 */
export async function issuePriorMonthInvoices(now: Date = new Date(), issuer: StripeIssuer = realStripeIssuer): Promise<{
  monthStart: Date;
  invoicesIssued: number;
  invoicesSkippedNoCustomer: number;
  invoicesSkippedNoLines: number;
  invoicesSkippedAlreadyIssued: number;
}> {
  // Closed prior month = the London month preceding the current one.
  // billingMonthStart(now) gives the current month's start; subtract a day,
  // then take billingMonthStart of THAT to get the previous month's start.
  const currentMonthStart = billingMonthStart(now);
  const inPriorMonth = new Date(currentMonthStart.getTime() - 24 * 3_600_000);
  const priorMonthStart = billingMonthStart(inPriorMonth);

  const buildingInvoices = await prisma.invoice.findMany({
    where: { monthStart: priorMonthStart, status: "building" },
    select: {
      id: true,
      agencyId: true,
      stripeInvoiceId: true,
      agency: { select: { stripeCustomerId: true, name: true } },
      lines: { select: { description: true, totalPence: true } },
    },
  });

  let invoicesIssued = 0;
  let invoicesSkippedNoCustomer = 0;
  let invoicesSkippedNoLines = 0;
  let invoicesSkippedAlreadyIssued = 0;

  for (const inv of buildingInvoices) {
    if (inv.stripeInvoiceId) {
      invoicesSkippedAlreadyIssued++;
      continue;
    }
    if (!inv.agency.stripeCustomerId) {
      // No card on file — can't bill. Leave as building; agency must add a card.
      // PR 7 doesn't dunning-email these yet; deferred to a later pass.
      invoicesSkippedNoCustomer++;
      continue;
    }
    // Check the NET total (sum of positive fees and any negative credits).
    // If net <= 0 (e.g. credits cancelled all fees, or only credits), there's
    // nothing to charge — mark issued without a Stripe call so we don't loop.
    // Any surplus credit is already applied (PR 5's accrual marks it) and
    // doesn't carry forward as a new credit — that prevents double-credit.
    const netTotal = inv.lines.reduce((s, l) => s + l.totalPence, 0);
    if (netTotal <= 0) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: "issued", issuedAt: new Date() },
      });
      invoicesSkippedNoLines++;
      continue;
    }

    // Send ALL lines to Stripe (positive fees + any negative credits) so the
    // customer sees the breakdown on their Stripe invoice. Stripe supports
    // negative-amount InvoiceItems for credits.
    const { stripeInvoiceId } = await issuer({
      customerId: inv.agency.stripeCustomerId,
      agencyId: inv.agencyId,
      monthStart: priorMonthStart,
      lines: inv.lines.map((l) => ({ description: l.description, amountPence: l.totalPence })),
    });

    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: "issued", issuedAt: new Date(), stripeInvoiceId },
    });
    invoicesIssued++;
  }

  return {
    monthStart: priorMonthStart,
    invoicesIssued,
    invoicesSkippedNoCustomer,
    invoicesSkippedNoLines,
    invoicesSkippedAlreadyIssued,
  };
}
