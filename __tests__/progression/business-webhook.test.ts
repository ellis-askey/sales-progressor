/**
 * @jest-environment node
 *
 * Stripe webhook — progression-business subscription branch (#3b). When a Stripe
 * invoice isn't one of our agency Invoice rows, it may be a business subscription
 * invoice; we match by customer and update the business's dunning flags. This is
 * the only non-Stripe-API logic in #3b, so it's the part worth unit-testing.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findFirst: jest.fn(async () => null) },
    progressionBusiness: { updateMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: jest.fn(),
  },
}));

import { processStripeEvent } from "@/lib/billing/stripe-webhook";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
const evt = (type: string, customer: unknown) => ({
  id: "evt_1", type, created: 1_700_000_000,
  data: { object: { id: "in_1", customer } },
});

beforeEach(() => jest.clearAllMocks());

it("payment_succeeded for a business subscription clears the dunning flags", async () => {
  const res = await processStripeEvent(evt("invoice.payment_succeeded", "cus_biz"));
  expect(res).toEqual({ handled: true, action: "marked_paid" });
  expect(p.progressionBusiness.updateMany).toHaveBeenCalledWith({
    where: { stripeCustomerId: "cus_biz" },
    data: { paymentFailedAt: null, newFileCreationBlockedAt: null },
  });
});

it("payment_failed for a business subscription sets paymentFailedAt (first failure only)", async () => {
  const res = await processStripeEvent(evt("invoice.payment_failed", "cus_biz"));
  expect(res).toEqual({ handled: true, action: "marked_failed" });
  expect(p.progressionBusiness.updateMany).toHaveBeenCalledWith({
    where: { stripeCustomerId: "cus_biz", paymentFailedAt: null },
    data: { paymentFailedAt: expect.any(Date) },
  });
});

it("an unknown invoice with no matching business is a safe no-op", async () => {
  p.progressionBusiness.updateMany.mockResolvedValueOnce({ count: 0 });
  const res = await processStripeEvent(evt("invoice.payment_succeeded", "cus_unknown"));
  expect(res).toEqual({ handled: true, action: "noop_invoice_not_found" });
});
