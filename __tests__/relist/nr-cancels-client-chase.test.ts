/**
 * @jest-environment node
 *
 * markNotRequired cancels ClientChaseState (audit P2/B1, Fix 10B).
 *
 * completeMilestone already cancels active ClientChaseState rows for a step;
 * markNotRequired did not. Without it, the client-escalation pass later escalated
 * the still-active chase and handed the agent a spurious "client silent for 14
 * days" task for a step that was already resolved by marking it Not Required.
 */

jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/services/reminders", () => ({
  evaluateTransactionReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    milestoneDefinition: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    milestoneCompletion: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    propertyTransaction: { findUnique: jest.fn() },
    outboundMessage: { create: jest.fn() },
    clientChaseState: { updateMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { markNotRequired } from "@/lib/services/milestones";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  p.milestoneDefinition.findUnique.mockResolvedValue({ name: "Book your survey", code: "PM9", side: "purchaser" });
  p.milestoneDefinition.findFirst.mockResolvedValue(null); // short-circuits maybeUnlockExchangeGate
  p.milestoneDefinition.findMany.mockResolvedValue([]);     // unlockDirectDependents no-op
  p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: null });
  p.milestoneCompletion.findFirst.mockResolvedValue(null);  // no existing row → create branch
  p.milestoneCompletion.findMany.mockResolvedValue([]);
  p.milestoneCompletion.create.mockResolvedValue({ id: "mc1" });
  p.milestoneCompletion.update.mockResolvedValue({ id: "mc1" });
  p.outboundMessage.create.mockResolvedValue({});
  p.clientChaseState.updateMany.mockResolvedValue({ count: 1 });
});

describe("markNotRequired cancels the client chase", () => {
  it("cancels active ClientChaseState for the milestone when marked not required", async () => {
    await markNotRequired("t1", "pm9def", "u1", "Agent", "Cash buyer, no survey");

    expect(p.clientChaseState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "t1", milestoneCode: "PM9", status: "active" },
        data: { status: "cancelled", statusReason: "Milestone marked not required" },
      }),
    );
  });
});
