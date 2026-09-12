/**
 * PR3 — Milestone availability history (Data Optionality capture-now).
 *
 * Unit-tests the pure row-builder that recordAvailabilityTransition persists.
 * The DB write itself is a thin wrapper over the same Prisma client the
 * milestone state change runs on (so it commits/rolls back atomically); there
 * is no DB test harness in this repo, so the wiring is covered by tsc + the
 * pre-commit typecheck and the state-transition logic is unchanged (the event
 * insert is purely additive). This test locks the derivation logic:
 *  - side is derived from the milestone code (VM* → vendor, PM* → purchaser)
 *  - transition / cause / round attribution pass through unchanged.
 */

import {
  buildAvailabilityEvent,
  sideForMilestoneCode,
} from "@/lib/services/milestone-availability-history";

describe("sideForMilestoneCode", () => {
  it("maps VM* to vendor and PM* to purchaser", () => {
    expect(sideForMilestoneCode("VM1")).toBe("vendor");
    expect(sideForMilestoneCode("VM18")).toBe("vendor");
    expect(sideForMilestoneCode("PM13")).toBe("purchaser");
    expect(sideForMilestoneCode("PM25")).toBe("purchaser");
  });

  it("returns null for anything else", () => {
    expect(sideForMilestoneCode("X1")).toBeNull();
    expect(sideForMilestoneCode("")).toBeNull();
  });
});

describe("buildAvailabilityEvent", () => {
  it("builds a became_available row with derived side and round attribution", () => {
    const row = buildAvailabilityEvent({
      transactionId: "tx1",
      milestoneDefinitionId: "def-pm13",
      milestoneCode: "PM13",
      buyerRoundId: "round-2",
      transition: "became_available",
      cause: "prereq_satisfied",
    });
    expect(row).toEqual({
      transactionId: "tx1",
      milestoneDefinitionId: "def-pm13",
      milestoneCode: "PM13",
      buyerRoundId: "round-2",
      side: "purchaser",
      transition: "became_available",
      cause: "prereq_satisfied",
    });
  });

  it("keeps buyerRoundId null for a vendor (file-level) milestone", () => {
    const row = buildAvailabilityEvent({
      transactionId: "tx1",
      milestoneDefinitionId: "def-vm18",
      milestoneCode: "VM18",
      buyerRoundId: null,
      transition: "became_locked",
      cause: "gate_relock",
    });
    expect(row.side).toBe("vendor");
    expect(row.buyerRoundId).toBeNull();
    expect(row.transition).toBe("became_locked");
    expect(row.cause).toBe("gate_relock");
  });
});
