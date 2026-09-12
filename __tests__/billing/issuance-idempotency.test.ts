/**
 * @jest-environment node
 *
 * Invoice issuance idempotency + per-invoice isolation (audit P0-2).
 *
 * realStripeIssuer now stamps deterministic Stripe idempotency keys, so a retry
 * after a crash between charging and persisting stripeInvoiceId replays the
 * original Stripe objects instead of creating a second auto-charging invoice
 * (no double charge). issuePriorMonthInvoices now isolates each invoice so one
 * agency's failure doesn't abort the rest of the month, and an already-issued
 * invoice is never re-sent.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) } },
}));
jest.mock("@/lib/stripe", () => {
  const invoiceItems = { create: jest.fn().mockResolvedValue({ id: "ii_x" }) };
  const invoices = { create: jest.fn().mockResolvedValue({ id: "in_x" }) };
  return { getStripeClient: () => ({ invoiceItems, invoices }) };
});

import { issuePriorMonthInvoices, realStripeIssuer } from "@/lib/billing/issuance";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

const p = prisma as any;
const stripe = (getStripeClient as any)();
const itemsCreate = stripe.invoiceItems.create as jest.Mock;
const invCreate = stripe.invoices.create as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("realStripeIssuer idempotency keys (double-charge prevention)", () => {
  it("sends the SAME deterministic idempotency keys on a retry for the same agency/month", async () => {
    const monthStart = new Date("2026-01-01T00:00:00.000Z");
    const args = { customerId: "cus_1", agencyId: "A", monthStart, lines: [{ description: "Progression fee", amountPence: 25000 }] };

    await realStripeIssuer(args);
    await realStripeIssuer(args); // simulated retry after a crash before persistence

    const itemKeys = itemsCreate.mock.calls.map((c) => c[1]?.idempotencyKey);
    const invKeys = invCreate.mock.calls.map((c) => c[1]?.idempotencyKey);
    // Both runs use identical keys → Stripe dedupes the retry (exactly-once charge).
    expect(itemKeys).toEqual(["issue:A:2026-01-01T00:00:00.000Z:item:0", "issue:A:2026-01-01T00:00:00.000Z:item:0"]);
    expect(invKeys).toEqual(["issue:A:2026-01-01T00:00:00.000Z:invoice", "issue:A:2026-01-01T00:00:00.000Z:invoice"]);
  });
});

describe("issuePriorMonthInvoices per-invoice isolation + retry safety", () => {
  function building(id: string, agencyId: string, opts: { stripeInvoiceId?: string | null } = {}) {
    return {
      id, agencyId, stripeInvoiceId: opts.stripeInvoiceId ?? null,
      agency: { stripeCustomerId: "cus_" + agencyId, name: agencyId },
      lines: [{ description: "Fee", totalPence: 25000 }],
    };
  }

  it("one agency's failure does not abort issuance for the others", async () => {
    p.invoice.findMany.mockResolvedValue([building("1", "a"), building("2", "b"), building("3", "c")]);
    const issuer = jest.fn(async ({ agencyId }: { agencyId: string }) => {
      if (agencyId === "b") throw new Error("Stripe 402 on agency b");
      return { stripeInvoiceId: "in_" + agencyId };
    });

    const res = await issuePriorMonthInvoices(new Date("2026-02-15T12:00:00.000Z"), issuer);

    expect(res.invoicesIssued).toBe(2);
    expect(res.invoicesFailed).toBe(1);
    // a and c were persisted; b was not (stays building → retried next run)
    const updatedIds = p.invoice.update.mock.calls.map((c: any[]) => c[0].where.id);
    expect(updatedIds).toEqual(["1", "3"]);
  });

  it("does not re-issue an invoice that already has a Stripe invoice id (retry safety)", async () => {
    p.invoice.findMany.mockResolvedValue([building("1", "a", { stripeInvoiceId: "in_existing" })]);
    const issuer = jest.fn();

    const res = await issuePriorMonthInvoices(new Date("2026-02-15T12:00:00.000Z"), issuer);

    expect(issuer).not.toHaveBeenCalled();
    expect(res.invoicesSkippedAlreadyIssued).toBe(1);
    expect(res.invoicesIssued).toBe(0);
  });
});
