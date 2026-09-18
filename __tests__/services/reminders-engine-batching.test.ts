/**
 * Phase 4 (perceived performance, PERF-08) — write-equivalence tests for the
 * reminder engine's batched reads.
 *
 * evaluateTransactionReminders used to issue up to three findFirst reads per
 * rule (active log ×2 + chase-task checks); those are now served from
 * pre-loop snapshots. These tests pin the contract that matters: for each
 * major branch the engine issues the SAME WRITES with the same arguments as
 * before, and the per-rule findFirst reads are gone (only the deliberate
 * post-write re-read remains).
 */

jest.mock("@/lib/agent/push-events", () => ({ pushChaseEscalation: jest.fn(() => Promise.resolve()) }));
jest.mock("@/lib/services/comms", () => ({ createCommunicationRecord: jest.fn(async () => ({})) }));
// access-scope transitively imports next-auth (openid-client), which cannot
// load under jest — same mock as the other suites that touch reminders.
jest.mock("@/lib/security/access-scope", () => ({
  scopeOwnershipWhere: jest.fn((_s: unknown, id: string) => ({ id })),
  scopeChaseTaskWhere: jest.fn((_s: unknown, id: string) => ({ id })),
  scopeReminderLogWhere: jest.fn((_s: unknown, id: string) => ({ id })),
}));

const prismaMock = {
  propertyTransaction: { findUnique: jest.fn() },
  milestoneCompletion: { findMany: jest.fn() },
  milestoneDefinition: { findMany: jest.fn(async () => []) },
  reminderRule: { findMany: jest.fn() },
  reminderLog: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(async () => ({})),
    create: jest.fn(async () => ({})),
  },
  chaseTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({ count: 0 })),
    create: jest.fn(async () => ({})),
  },
  outboundMessage: { create: jest.fn(async () => ({})) },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { evaluateTransactionReminders } from "@/lib/services/reminders";

const TX = {
  id: "tx-1",
  status: "active",
  assignedUserId: "sp-1",
  activeBuyerRoundId: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  completionDate: null,
  activeBuyerRound: null,
};

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    name: "Chase: test step",
    isActive: true,
    requiresExchangeReady: false,
    targetMilestoneCode: null,
    anchorMilestoneId: null,
    anchorMilestone: null,
    useEventDate: false,
    useCompletionDate: false,
    graceDays: 3,
    repeatEveryDays: 3,
    escalateAfterChases: 3,
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    transactionId: "tx-1",
    reminderRuleId: "rule-1",
    status: "active",
    nextDueDate: new Date("2026-08-05T05:00:00Z"),
    sourceDateUsed: null,
    snoozedUntil: null,
    createdAt: new Date("2026-08-01T11:00:00Z"),
    buyerRoundId: null,
    reminderRule: { name: "Chase: test step" },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.propertyTransaction.findUnique.mockResolvedValue(TX);
  prismaMock.milestoneCompletion.findMany.mockResolvedValue([]);
  prismaMock.milestoneDefinition.findMany.mockResolvedValue([]);
  prismaMock.reminderLog.findMany.mockResolvedValue([]);
  prismaMock.chaseTask.findMany.mockResolvedValue([]);
  prismaMock.reminderLog.findFirst.mockResolvedValue(null);
  prismaMock.chaseTask.findFirst.mockResolvedValue(null);
});

describe("evaluateTransactionReminders — batched reads, identical writes", () => {
  it("deactivation branch: target complete → same inactive/cancel/audit writes, zero per-rule findFirst reads", async () => {
    const completion = {
      milestoneDefinitionId: "def-vm7",
      state: "complete",
      eventDate: null,
      completedAt: new Date("2026-08-03T09:00:00Z"),
      notRequiredAt: null,
      updatedAt: new Date("2026-08-03T09:00:00Z"),
      reconciledAtClaim: false,
      milestoneDefinition: { id: "def-vm7", code: "VM7" },
    };
    prismaMock.milestoneCompletion.findMany.mockResolvedValue([completion]);
    prismaMock.reminderRule.findMany.mockResolvedValue([makeRule({ targetMilestoneCode: "VM7" })]);
    prismaMock.reminderLog.findMany.mockResolvedValue([makeLog()]);

    await evaluateTransactionReminders("tx-1");

    // Same writes as the unbatched engine:
    expect(prismaMock.reminderLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: { status: "inactive", statusReason: "Target milestone confirmed" },
    });
    expect(prismaMock.chaseTask.updateMany).toHaveBeenCalledWith({
      where: { reminderLogId: "log-1", status: "pending" },
      data: { status: "inactive" },
    });
    expect(prismaMock.outboundMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "tx-1",
          isAutomated: true,
          content: expect.stringContaining("Target milestone confirmed"),
        }),
      }),
    );
    // The per-rule reads are gone:
    expect(prismaMock.reminderLog.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.chaseTask.findFirst).not.toHaveBeenCalled();
  });

  it("existing-log branch: due date moved → same update/sync writes; chased-before check served from snapshot", async () => {
    prismaMock.reminderRule.findMany.mockResolvedValue([makeRule()]);
    const log = makeLog({ nextDueDate: new Date("2026-09-01T05:00:00Z") });
    prismaMock.reminderLog.findMany.mockResolvedValue([log]);
    // Post-write re-read (the one deliberate live read) returns the log.
    prismaMock.reminderLog.findFirst.mockResolvedValue(log);

    await evaluateTransactionReminders("tx-1");

    // nextDueDate recompute wrote (anchor = tx.createdAt + 3 days ≠ 1 Sep):
    expect(prismaMock.reminderLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-1" },
        data: expect.objectContaining({ nextDueDate: expect.any(Date), sourceDateUsed: expect.any(Date) }),
      }),
    );
    // Pending-task date sync came with it:
    expect(prismaMock.chaseTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reminderLogId: "log-1", status: "pending", chaseCount: 0 },
      }),
    );
    // chased-before check no longer reads per-rule:
    expect(prismaMock.chaseTask.findFirst).not.toHaveBeenCalled();
    // Exactly ONE live reminderLog.findFirst remains: the post-write re-read.
    expect(prismaMock.reminderLog.findFirst).toHaveBeenCalledTimes(1);
  });

  it("chased-before log (snapshot hit): nextDueDate is NOT touched — cadence belongs to applyChaseToTask", async () => {
    prismaMock.reminderRule.findMany.mockResolvedValue([makeRule()]);
    const log = makeLog({ nextDueDate: new Date("2026-09-01T05:00:00Z") });
    prismaMock.reminderLog.findMany.mockResolvedValue([log]);
    // Snapshot says this log has a chased task (chaseCount > 0):
    prismaMock.chaseTask.findMany
      .mockResolvedValueOnce([{ reminderLogId: "log-1" }]) // chased rows
      .mockResolvedValueOnce([]); // pending tasks
    prismaMock.reminderLog.findFirst.mockResolvedValue(log);

    await evaluateTransactionReminders("tx-1");

    expect(prismaMock.reminderLog.update).not.toHaveBeenCalled();
  });

  it("create branch: no active log → same create + audit + due-today task create; post-create re-read stays live", async () => {
    prismaMock.reminderRule.findMany.mockResolvedValue([makeRule({ graceDays: 0 })]);
    prismaMock.reminderLog.findMany.mockResolvedValue([]); // no snapshot entry
    const created = makeLog({ id: "log-new", nextDueDate: new Date("2026-08-01T05:00:00Z") });
    prismaMock.reminderLog.findFirst.mockResolvedValue(created); // live re-read finds it

    await evaluateTransactionReminders("tx-1");

    expect(prismaMock.reminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "tx-1",
          reminderRuleId: "rule-1",
          status: "active",
        }),
      }),
    );
    // The post-create re-read is the surviving live read:
    expect(prismaMock.reminderLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transactionId: "tx-1", reminderRuleId: "rule-1", status: "active" } }),
    );
    // Due today (grace 0, anchor in the past) → chase task created off the log:
    expect(prismaMock.chaseTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reminderLogId: "log-new", status: "pending", chaseCount: 0 }),
      }),
    );
  });

  it("non-active transaction: engine no-ops before any snapshot read", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...TX, status: "completed" });

    await evaluateTransactionReminders("tx-1");

    expect(prismaMock.reminderLog.findMany).not.toHaveBeenCalled();
    expect(prismaMock.reminderLog.update).not.toHaveBeenCalled();
    expect(prismaMock.reminderLog.create).not.toHaveBeenCalled();
  });
});
