/**
 * @jest-environment node
 *
 * What a progression business owes TSP (capstone #3a): £59 base (owner) + £39 per
 * ADDITIONAL active member + £5 per sale ADDED this month. Display/accrual only —
 * no money moves here.
 */
jest.mock("@/lib/billing/period", () => ({
  billingMonthRange: () => ({ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") }),
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { user: { count: jest.fn() }, propertyTransaction: { findMany: jest.fn() } },
}));

import { getBusinessBillingSummary } from "@/lib/progression/business-billing";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
beforeEach(() => jest.clearAllMocks());

it("solo owner, no sales added → just the £59 base", async () => {
  p.user.count.mockResolvedValue(1);
  p.propertyTransaction.findMany.mockResolvedValue([]);
  const s = await getBusinessBillingSummary("biz1");
  expect(s.memberCount).toBe(1);
  expect(s.extraMembers).toBe(0);
  expect(s.basePence).toBe(5900);
  expect(s.seatsPence).toBe(0);
  expect(s.saleCount).toBe(0);
  expect(s.totalPence).toBe(5900);
  expect(s.lines).toHaveLength(1); // base only
});

it("owner + 2 members + 2 sales added → 5900 + 2*3900 + 2*500", async () => {
  p.user.count.mockResolvedValue(3);
  p.propertyTransaction.findMany.mockResolvedValue([
    { id: "t1", propertyAddress: "1 A St", businessPerSaleChargedAt: new Date() },
    { id: "t2", propertyAddress: "2 B St", businessPerSaleChargedAt: new Date() },
  ]);
  const s = await getBusinessBillingSummary("biz1");
  expect(s.extraMembers).toBe(2);
  expect(s.seatsPence).toBe(7800);
  expect(s.saleCount).toBe(2);
  expect(s.perSalePence).toBe(1000);
  expect(s.totalPence).toBe(5900 + 7800 + 1000);
  // base + seats + 2 per-sale lines
  expect(s.lines).toHaveLength(4);
});

it("counts THIS business's files ADDED in the month", async () => {
  p.user.count.mockResolvedValue(1);
  p.propertyTransaction.findMany.mockResolvedValue([]);
  await getBusinessBillingSummary("biz1");
  expect(p.propertyTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: {
      progressionBusinessId: "biz1",
      businessPerSaleChargedAt: { gte: new Date("2026-10-01T00:00:00Z"), lt: new Date("2026-11-01T00:00:00Z") },
    },
  }));
  expect(p.user.count).toHaveBeenCalledWith({ where: { progressionBusinessId: "biz1", deactivatedAt: null } });
});
