/**
 * @jest-environment node
 *
 * Chain progress % must round-scope to the active buyer round (audit
 * full-audit-2026-10, finding DATA-005).
 *
 * A relisted file keeps the previous (dead) buyer's completed purchaser rows on
 * disk. The owner's own progress figure already excludes them, but the SHARED
 * chain % (public claim page via getFileProgressPercent, other agencies' chain
 * view, solicitor portal) counted them, so outsiders saw a higher % than reality
 * and could assume a relisted sale was nearly ready to exchange.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findUnique: jest.fn() },
    milestoneCompletion: { findMany: jest.fn() },
  },
}));

import { getFileProgressPercent } from "@/lib/services/chains";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
beforeEach(() => jest.clearAllMocks());

const row = (state: string, buyerRoundId: string | null, code: string, weight: number) => ({
  state,
  eventDate: null,
  completedAt: state === "complete" ? new Date("2026-01-01") : null,
  reconciledAtClaim: false,
  buyerRoundId,
  milestoneDefinition: { code, weight },
});

describe("getFileProgressPercent round-scoping (DATA-005)", () => {
  it("ignores the previous buyer round's completed steps after a relist", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: "round-2" });
    p.milestoneCompletion.findMany.mockResolvedValue([
      row("complete", null, "VM1", 1), // vendor file-level — shared, always counts
      row("complete", "round-1", "PM1", 1), // DEAD round — must be excluded
      row("complete", "round-1", "PM2", 1), // DEAD round — must be excluded
      row("complete", "round-2", "PM1", 1), // active round — counts
      row("available", "round-2", "PM2", 1), // active round, not done — applicable, not complete
    ]);

    // Active-round view: applicable = VM1 + PM1@r2 + PM2@r2 = 3; complete = VM1 + PM1@r2 = 2 => 67%.
    // (If the dead round still counted it would be 4/5 = 80%.)
    expect(await getFileProgressPercent("tx1")).toBe(67);
  });

  it("returns the full figure for a never-relisted file (single round)", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: "round-1" });
    p.milestoneCompletion.findMany.mockResolvedValue([
      row("complete", null, "VM1", 1),
      row("complete", "round-1", "PM1", 1),
      row("available", "round-1", "PM2", 1),
    ]);
    // 2 of 3 applicable complete => 67%.
    expect(await getFileProgressPercent("tx1")).toBe(67);
  });
});
