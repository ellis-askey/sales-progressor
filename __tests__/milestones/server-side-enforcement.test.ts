/**
 * @jest-environment node
 *
 * Server-side exchange-gate + Not-Required enforcement (audit P1-7).
 *
 * The agent UI hides the exchange-gate Confirm button until the gate unlocks,
 * and only offers "Not required" on the allowed milestones. Before the fix the
 * server (completeMilestone / markNotRequiredWithCascade) did NOT re-check those
 * rules, so a crafted API request could complete a LOCKED exchange gate (skipping
 * required legal steps) or mark an arbitrary milestone Not Required (inflating
 * progress / opening the gate). These tests drive the service functions directly
 * and prove the bypasses now fail.
 */

jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    milestoneDefinition: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    propertyTransaction: { findUnique: jest.fn() },
    milestoneCompletion: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { completeMilestone, markNotRequiredWithCascade } from "@/lib/services/milestones";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
const confirmer = { kind: "user" as const, id: "u1", name: "Agent" };

beforeEach(() => jest.clearAllMocks());

describe("exchange gate cannot be completed while locked", () => {
  beforeEach(() => {
    p.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM18", name: "Ready to exchange", summaryTemplate: null, side: "vendor" });
    p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: null });
  });

  it("rejects completing VM18 when the gate row is locked", async () => {
    p.milestoneCompletion.findFirst.mockResolvedValue({ state: "locked" });
    await expect(
      completeMilestone({ transactionId: "t1", milestoneDefinitionId: "vm18", confirmer }),
    ).rejects.toThrow("EXCHANGE_GATE_LOCKED");
  });

  it("rejects completing VM18 when there is no gate row yet", async () => {
    p.milestoneCompletion.findFirst.mockResolvedValue(null);
    await expect(
      completeMilestone({ transactionId: "t1", milestoneDefinitionId: "vm18", confirmer }),
    ).rejects.toThrow("EXCHANGE_GATE_LOCKED");
  });

  it("passes the gate guard once it is available (reaches the write path)", async () => {
    // First findFirst = gate-state check (available); second = existing-row lookup (none) → create path.
    p.milestoneCompletion.findFirst.mockResolvedValueOnce({ state: "available" }).mockResolvedValueOnce(null);
    p.milestoneCompletion.create.mockRejectedValue(new Error("REACHED_WRITE"));
    await expect(
      completeMilestone({ transactionId: "t1", milestoneDefinitionId: "vm18", confirmer }),
    ).rejects.toThrow("REACHED_WRITE");
  });
});

describe("manual Not-Required is restricted to the UI allow-list", () => {
  const base = { transactionId: "t1", completedById: "u1", completedByName: "Agent", reason: "n/a" };

  it("rejects marking a disallowed milestone (VM7) Not Required and does not write", async () => {
    p.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM7" });
    p.propertyTransaction.findUnique.mockResolvedValue({ purchaseType: "mortgage" });
    await expect(markNotRequiredWithCascade({ ...base, milestoneDefinitionId: "vm7" }))
      .rejects.toThrow("NOT_REQUIRED_NOT_ALLOWED");
    expect(p.milestoneDefinition.findMany).not.toHaveBeenCalled();
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it("allows PM9 on any file (reaches the cascade/write path)", async () => {
    p.milestoneDefinition.findUnique.mockResolvedValue({ code: "PM9" });
    p.propertyTransaction.findUnique.mockResolvedValue({ purchaseType: "mortgage" });
    p.milestoneDefinition.findMany.mockRejectedValue(new Error("PASSED_GUARD"));
    await expect(markNotRequiredWithCascade({ ...base, milestoneDefinitionId: "pm9" }))
      .rejects.toThrow("PASSED_GUARD");
  });

  it("allows PM8 on a cash file", async () => {
    p.milestoneDefinition.findUnique.mockResolvedValue({ code: "PM8" });
    p.milestoneDefinition.findMany.mockRejectedValue(new Error("PASSED_GUARD"));
    await expect(markNotRequiredWithCascade({ ...base, milestoneDefinitionId: "pm8", purchaseType: "cash_buyer" }))
      .rejects.toThrow("PASSED_GUARD");
  });

  it("rejects PM8 on a mortgage file (not a cash buyer)", async () => {
    p.milestoneDefinition.findUnique.mockResolvedValue({ code: "PM8" });
    await expect(markNotRequiredWithCascade({ ...base, milestoneDefinitionId: "pm8", purchaseType: "mortgage" }))
      .rejects.toThrow("NOT_REQUIRED_NOT_ALLOWED");
    expect(p.milestoneDefinition.findMany).not.toHaveBeenCalled();
  });
});
