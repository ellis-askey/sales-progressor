/**
 * @jest-environment node
 *
 * One-off seller-facing relist update (Fix 4, 2026-09-12).
 *
 * When a sale is relisted the seller's progress resets to the draft-contract-pack
 * stage. A single visibleToClient update is posted to the seller's portal feed
 * explaining this, attributed to the agency (no email). Two variants:
 *   - draft contract pack WAS issued before → "moved back to the draft contract pack stage"
 *   - it hadn't been → gentler "continue from its current stage"
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

function baseMocks() {
  p.propertyTransaction.findFirst.mockResolvedValue({
    id: "t1", propertyAddress: "1 High St", status: "withdrawn", exchangedAt: null,
    activeBuyerRoundId: "r1", fallThroughReason: "buyer pulled out", purchasePrice: 300000,
    tenure: "freehold", purchaseType: "mortgage", serviceType: "self_managed",
    agencyId: "A", agentUserId: "u1", assignedUserId: null, chainLinkId: null,
  });
  p.buyerRound.findUnique.mockResolvedValue({ id: "r1", roundNumber: 1 });
  p.buyerRound.create.mockResolvedValue({ id: "r2", roundNumber: 2, createdAt: new Date("2026-03-01T00:00:00.000Z") });
  p.contact.create.mockResolvedValue({ id: "c2" });
  // A portal-eligible vendor contact exists → the relist update is posted to them.
  p.contact.findMany.mockResolvedValue([{ id: "vendor1" }]);
  // Reset milestone reads to empty by default (clearAllMocks keeps prior
  // implementations, so set these explicitly each test to avoid cross-test bleed).
  p.milestoneDefinition.findMany.mockResolvedValue([]);
  p.milestoneCompletion.findMany.mockResolvedValue([]);
}

async function runRelist() {
  await relistTransactionImpl(
    { transactionId: "t1", newBuyer: { name: "New Buyer" }, onwardSale: null },
    { scope: { kind: "all" }, userId: "u1", userName: "Agent" } as any,
  );
}

function postedSellerUpdate(): string | null {
  const call = p.outboundMessage.create.mock.calls
    .map((c: any[]) => c[0]?.data)
    .find((d: any) => d?.visibleToClient === true && Array.isArray(d?.contactIds) && d.contactIds.includes("vendor1"));
  return call?.content ?? null;
}

beforeEach(() => jest.clearAllMocks());

describe("seller relist update", () => {
  it("posts the 'moved back to draft contract pack' variant when VM7 was complete", async () => {
    baseMocks();
    // allDefs include VM7; the snapshot read returns VM7 as complete.
    p.milestoneDefinition.findMany.mockResolvedValue([{ id: "vm7", code: "VM7", side: "vendor" }]);
    p.milestoneCompletion.findMany.mockResolvedValue([
      { id: "mc7", milestoneDefinitionId: "vm7", state: "complete", completedAt: null, completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    ]);

    await runRelist();

    const content = postedSellerUpdate();
    expect(content).toContain("moved back to the draft contract pack stage");
    expect(content).toContain("1 High St");
  });

  it("posts the gentler 'continue from its current stage' variant when the draft pack was not issued", async () => {
    baseMocks(); // milestoneDefinition/Completion.findMany default to [] → VM7 not complete
    await runRelist();

    const content = postedSellerUpdate();
    expect(content).toContain("continue from its current stage");
    expect(content).toContain("nothing you need to redo");
  });
});
