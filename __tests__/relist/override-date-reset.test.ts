/**
 * @jest-environment node
 *
 * Relist clears the manual exchange-date override (audit P2/B2, Fix 10A).
 *
 * overridePredictedDate belongs to the PREVIOUS buyer and the portal reads it in
 * preference to expectedExchangeDate. The relist STEP 9 reset cleared
 * expectedExchangeDate / twelveWeekTarget / completionDate but left
 * overridePredictedDate, so the new buyer saw the old buyer's manual target. This
 * drives relistTransactionImpl and asserts the STEP 9 update now nulls it.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/services/reminders", () => ({
  evaluateTransactionReminders: jest.fn().mockResolvedValue(undefined),
  setUkChaseTime: jest.fn(),
}));
jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    propertyTransaction: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    buyerRound: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}), create: jest.fn() },
    milestoneDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    milestoneCompletion: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    contact: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    priceHistory: { create: jest.fn().mockResolvedValue({}) },
    chaseTask: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    reminderLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    clientChaseState: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    transactionHoldPeriod: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    outboundMessage: { create: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { relistTransactionImpl } from "@/app/actions/transactions";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  p.propertyTransaction.findFirst.mockResolvedValue({
    id: "t1", propertyAddress: "1 High St", status: "withdrawn", exchangedAt: null,
    activeBuyerRoundId: "r1", fallThroughReason: "buyer pulled out", purchasePrice: 300000,
    tenure: "freehold", purchaseType: "mortgage", serviceType: "self_managed",
    agencyId: "A", agentUserId: "u1", assignedUserId: null, chainLinkId: null,
  });
  p.buyerRound.findUnique.mockResolvedValue({ id: "r1", roundNumber: 1 });
  p.buyerRound.create.mockResolvedValue({ id: "r2", roundNumber: 2, createdAt: new Date("2026-03-01T00:00:00.000Z") });
  p.contact.create.mockResolvedValue({ id: "c2" });
});

describe("relist STEP 9 reset", () => {
  it("nulls overridePredictedDate alongside the other forecast resets", async () => {
    await relistTransactionImpl(
      { transactionId: "t1", newBuyer: { name: "New Buyer" }, onwardSale: null },
      { scope: { kind: "all" }, userId: "u1", userName: "Agent" } as any,
    );

    // The STEP 9 update is the one that flips status back to active.
    const step9 = p.propertyTransaction.update.mock.calls
      .map((c: any[]) => c[0])
      .find((arg: any) => arg?.data?.status === "active");

    expect(step9).toBeTruthy();
    expect(step9.data.overridePredictedDate).toBeNull();
    // The adjacent forecast resets are still present (regression guard).
    expect(step9.data.completionDate).toBeNull();
    expect(step9.data.expectedExchangeDate).toBeInstanceOf(Date);
  });
});
