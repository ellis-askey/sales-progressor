/**
 * @jest-environment node
 *
 * settleOpenBusinessInvoices — the "update card → pay the overdue invoice instantly"
 * path. When an owner updates their card while a payment is overdue, we pay every
 * OPEN invoice on the spot with the new (now-default) card rather than waiting for
 * Stripe's next Smart Retry. These tests cover the branch logic around the Stripe
 * calls (what gets paid, what's counted, what must never throw).
 */
const listMock = jest.fn();
const payMock = jest.fn();

jest.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({ invoices: { list: listMock, pay: payMock } }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusiness: { findUnique: jest.fn(async () => ({ stripeCustomerId: "cus_biz" })) },
  },
}));

import { settleOpenBusinessInvoices } from "@/lib/progression/business-stripe";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  p.progressionBusiness.findUnique.mockResolvedValue({ stripeCustomerId: "cus_biz" });
});

it("pays every open invoice and reports them settled", async () => {
  listMock.mockResolvedValueOnce({ data: [{ id: "in_1" }, { id: "in_2" }] });
  payMock.mockResolvedValue({ status: "paid" });

  const res = await settleOpenBusinessInvoices("biz_1");

  expect(res).toEqual({ paid: 2, failed: 0 });
  expect(listMock).toHaveBeenCalledWith({ customer: "cus_biz", status: "open", limit: 100 });
  expect(payMock).toHaveBeenCalledWith("in_1");
  expect(payMock).toHaveBeenCalledWith("in_2");
});

it("no open invoices is a no-op (normal first-time card save)", async () => {
  listMock.mockResolvedValueOnce({ data: [] });

  const res = await settleOpenBusinessInvoices("biz_1");

  expect(res).toEqual({ paid: 0, failed: 0 });
  expect(payMock).not.toHaveBeenCalled();
});

it("a decline is counted as failed and never throws", async () => {
  listMock.mockResolvedValueOnce({ data: [{ id: "in_1" }, { id: "in_2" }] });
  payMock
    .mockRejectedValueOnce(new Error("card_declined"))
    .mockResolvedValueOnce({ status: "paid" });

  const res = await settleOpenBusinessInvoices("biz_1");

  expect(res).toEqual({ paid: 1, failed: 1 });
});

it("an invoice that stays unpaid (no throw) is counted as failed", async () => {
  listMock.mockResolvedValueOnce({ data: [{ id: "in_1" }] });
  payMock.mockResolvedValueOnce({ status: "open" });

  const res = await settleOpenBusinessInvoices("biz_1");

  expect(res).toEqual({ paid: 0, failed: 1 });
});

it("no Stripe customer is a safe no-op", async () => {
  p.progressionBusiness.findUnique.mockResolvedValueOnce({ stripeCustomerId: null });

  const res = await settleOpenBusinessInvoices("biz_1");

  expect(res).toEqual({ paid: 0, failed: 0 });
  expect(listMock).not.toHaveBeenCalled();
});
