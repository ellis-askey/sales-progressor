/**
 * @jest-environment node
 *
 * Portal confirm idempotency (audit P1-6, portal side).
 *
 * portalCompleteMilestone allowed an already-complete milestone through to the
 * full completion cascade + client email fan-out, so a double-tap / network
 * retry re-fired the emails. The fix returns early (graceful no-op) when the
 * milestone is already complete. This test proves the cascade ($transaction) is
 * never opened in that case.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findUnique: jest.fn() },
    propertyTransaction: { findUnique: jest.fn() },
    milestoneDefinition: { findFirst: jest.fn() },
    milestoneCompletion: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { portalCompleteMilestone } from "@/lib/services/portal";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  p.contact.findUnique.mockResolvedValue({ id: "c1", name: "Pat Seller", roleType: "vendor", buyerRoundId: null, propertyTransactionId: "t1" });
  p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: null, status: "active" });
  p.milestoneDefinition.findFirst.mockResolvedValue({ id: "d1", code: "VM1", side: "vendor" });
});

describe("portalCompleteMilestone is idempotent on an already-complete step", () => {
  it("no-ops (does not open the cascade transaction) when the milestone is already complete", async () => {
    p.milestoneCompletion.findFirst.mockResolvedValue({ state: "complete" });
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "d1" }),
    ).resolves.toBeUndefined();
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it("still rejects a milestone that is neither available nor complete", async () => {
    p.milestoneCompletion.findFirst.mockResolvedValue({ state: "locked" });
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "d1" }),
    ).rejects.toThrow("Milestone not yet available");
    expect(p.$transaction).not.toHaveBeenCalled();
  });
});
