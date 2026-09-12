/**
 * @jest-environment node
 *
 * Transaction-status protection (audit P1-1).
 *
 * A withdrawn or completed sale is no longer live: the client portal must not be
 * able to confirm / mark-not-required a milestone on it (which would fire the
 * milestone cascade + client emails on a dead file). Reads are unaffected — only
 * the write paths refuse. Active sales are unaffected.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findUnique: jest.fn() },
    propertyTransaction: { findUnique: jest.fn() },
    milestoneDefinition: { findFirst: jest.fn() },
  },
}));

import {
  portalCompleteMilestone,
  portalMarkNotRequired,
  PORTAL_TRANSACTION_INACTIVE_ERROR,
} from "@/lib/services/portal";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  // Vendor contact (avoids the purchaser dead-round branch) on transaction t1.
  p.contact.findUnique.mockResolvedValue({
    id: "c1", name: "Pat Seller", roleType: "vendor", buyerRoundId: null, propertyTransactionId: "t1",
  });
});

function withStatus(status: string) {
  p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: "r1", status });
}

describe("portal milestone writes are blocked on dead/terminal transactions", () => {
  it("rejects confirm on a WITHDRAWN sale", async () => {
    withStatus("withdrawn");
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "m1" }),
    ).rejects.toThrow(PORTAL_TRANSACTION_INACTIVE_ERROR);
  });

  it("rejects confirm on a COMPLETED sale", async () => {
    withStatus("completed");
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "m1" }),
    ).rejects.toThrow(PORTAL_TRANSACTION_INACTIVE_ERROR);
  });

  it("rejects mark-not-required on a WITHDRAWN sale", async () => {
    withStatus("withdrawn");
    await expect(
      portalMarkNotRequired({ token: "tok", milestoneDefinitionId: "m1" }),
    ).rejects.toThrow(PORTAL_TRANSACTION_INACTIVE_ERROR);
  });

  it("does NOT block an ACTIVE sale (gets past the status guard)", async () => {
    withStatus("active");
    // def lookup returns null → the function proceeds past the status guard and
    // fails later with a different error, proving the status guard did not fire.
    p.milestoneDefinition.findFirst.mockResolvedValue(null);
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "m1" }),
    ).rejects.toThrow("Milestone not found");
  });

  it("does NOT block an ON_HOLD sale (paused, still live)", async () => {
    withStatus("on_hold");
    p.milestoneDefinition.findFirst.mockResolvedValue(null);
    await expect(
      portalCompleteMilestone({ token: "tok", milestoneDefinitionId: "m1" }),
    ).rejects.toThrow("Milestone not found");
  });
});
