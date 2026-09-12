/**
 * @jest-environment node
 *
 * Transaction-status protection (audit P1-2).
 *
 * maybeReopenCompletedTransaction is the inverse of maybeAutoCompleteTransaction.
 * Reversing a completion step (VM20/PM27) must not leave the file stranded at
 * status="completed" (which is what triggers a billing reversal against a sale
 * the system still calls a completed, billed deal). It must reopen to "active".
 */

jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findUnique: jest.fn(), update: jest.fn() },
    milestoneDefinition: { findMany: jest.fn() },
    milestoneCompletion: { findMany: jest.fn() },
    outboundMessage: { create: jest.fn() },
  },
}));

import { maybeReopenCompletedTransaction } from "@/lib/services/milestones";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
const VM20 = { id: "vm20", code: "VM20" };
const PM27 = { id: "pm27", code: "PM27" };

beforeEach(() => {
  jest.clearAllMocks();
  p.milestoneDefinition.findMany.mockResolvedValue([VM20, PM27]);
  p.propertyTransaction.update.mockResolvedValue({});
  p.outboundMessage.create.mockResolvedValue({});
});

describe("maybeReopenCompletedTransaction", () => {
  it("reopens a completed file to active when a completion step is no longer complete", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      id: "t1", status: "completed", activeBuyerRoundId: "r1", agencyId: "A",
    });
    // Only VM20 still complete (PM27 was just reversed)
    p.milestoneCompletion.findMany.mockResolvedValue([{ milestoneDefinitionId: "vm20" }]);

    const reopened = await maybeReopenCompletedTransaction("t1", { actorUserId: "u1" });

    expect(reopened).toBe(true);
    expect(p.propertyTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" }, data: { status: "active" } }),
    );
  });

  it("does nothing when the file is not completed (ordinary mid-file undo)", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      id: "t1", status: "active", activeBuyerRoundId: "r1", agencyId: "A",
    });

    const reopened = await maybeReopenCompletedTransaction("t1", { actorUserId: "u1" });

    expect(reopened).toBe(false);
    expect(p.propertyTransaction.update).not.toHaveBeenCalled();
  });

  it("does nothing when both completion steps remain complete", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      id: "t1", status: "completed", activeBuyerRoundId: "r1", agencyId: "A",
    });
    p.milestoneCompletion.findMany.mockResolvedValue([
      { milestoneDefinitionId: "vm20" }, { milestoneDefinitionId: "pm27" },
    ]);

    const reopened = await maybeReopenCompletedTransaction("t1", { actorUserId: "u1" });

    expect(reopened).toBe(false);
    expect(p.propertyTransaction.update).not.toHaveBeenCalled();
  });

  it("never throws if the DB read fails", async () => {
    p.propertyTransaction.findUnique.mockRejectedValue(new Error("db down"));
    await expect(maybeReopenCompletedTransaction("t1")).resolves.toBe(false);
  });
});
