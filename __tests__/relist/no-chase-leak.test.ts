/**
 * @jest-environment node
 *
 * Relist no-leak guard (2026-09-30 audit). The keystone regression test for the
 * bug class that surfaced on 4 Old Oak Gardens: after a relist, the PREVIOUS
 * buyer's ClientChaseState stays on the file (attributed to the archived round).
 * If a reader doesn't scope to the active round, that stale row leaks into the
 * new sale — the escalation pass re-escalated it and minted a phantom "client
 * chased / silent 14 days — handed to agent" task for a buyer who was never
 * chased.
 *
 * This locks in the fix in lib/services/client-chase-cron.ts findEscalationCandidates:
 * an archived-round row can never become an escalation candidate on the new round.
 * File-level (null round) rows are kept; only archived-round rows are dropped.
 *
 * If a future edit removes the round filter, this test fails before it ships.
 */

jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    clientChaseState: { findMany: jest.fn() },
    reminderRule: { findMany: jest.fn() },
    propertyTransaction: { findMany: jest.fn() },
  };
  return { prisma };
});

import { findEscalationCandidates } from "@/lib/services/client-chase-cron";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

const NOW = new Date("2026-09-30T09:00:00.000Z");
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 86_400_000); // past the 14-day silence ceiling

const ACTIVE_ROUND = "round-new";
const ARCHIVED_ROUND = "round-old";

// A chase state 30 days silent on PM8 — a 14-day-silence candidate IF it is read.
const stateRow = (over: Record<string, unknown>) => ({
  id: "x",
  transactionId: "tx1",
  contactId: "c",
  milestoneCode: "PM8",
  chaseCount: 1,
  firstChasedAt: THIRTY_DAYS_AGO,
  lastChasedAt: THIRTY_DAYS_AGO,
  lastEngagedAt: null,
  buyerRoundId: ACTIVE_ROUND,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  // 1st clientChaseState.findMany = the candidate rows; 2nd = engagement rows.
  p.clientChaseState.findMany
    .mockResolvedValueOnce([
      stateRow({ id: "ccs-new", contactId: "c-new", buyerRoundId: ACTIVE_ROUND }),
      stateRow({ id: "ccs-old", contactId: "c-old", buyerRoundId: ARCHIVED_ROUND }),
      stateRow({ id: "ccs-file", contactId: "c-vendor", milestoneCode: "VM11", buyerRoundId: null }),
    ])
    .mockResolvedValueOnce([]); // no engagement rows
  p.reminderRule.findMany.mockResolvedValue([
    { targetMilestoneCode: "PM8", repeatEveryDays: 5 },
    { targetMilestoneCode: "VM11", repeatEveryDays: 5 },
  ]);
  // The transaction's active round is round-new; round-old is archived.
  p.propertyTransaction.findMany.mockResolvedValue([
    { id: "tx1", chaseRuleSnapshot: null, activeBuyerRoundId: ACTIVE_ROUND },
  ]);
});

describe("findEscalationCandidates — relist round scoping", () => {
  it("drops the previous buyer's archived-round row (no phantom escalation on the new sale)", async () => {
    const candidates = await findEscalationCandidates(NOW);
    const ids = candidates.map((c) => c.stateId);

    // The previous buyer's row must NEVER become a candidate.
    expect(ids).not.toContain("ccs-old");
    // The current buyer's row (and file-level vendor row) still escalate normally.
    expect(ids).toContain("ccs-new");
    expect(ids).toContain("ccs-file");
    expect(candidates).toHaveLength(2);
  });

  it("keeps escalating the archived row's milestone for the NEW buyer only", async () => {
    const candidates = await findEscalationCandidates(NOW);
    const pm8 = candidates.filter((c) => c.milestoneCode === "PM8");
    // Both buyers had a silent PM8 chase, but only the active round's survives.
    expect(pm8).toHaveLength(1);
    expect(pm8[0].stateId).toBe("ccs-new");
  });
});
