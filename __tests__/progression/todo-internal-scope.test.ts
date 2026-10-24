/**
 * @jest-environment node
 *
 * To-Do internal-task scoping. A LINKED internal to-do is bounded to the viewer's
 * access scope (via its transaction) — no business ever sees TSP's or another
 * business's files. An UNLINKED one (no property) has no agency/business to scope
 * by, so it is bounded to its CREATOR: every role sees their own loose to-dos and
 * never anyone else's (critique #300 — previously these only surfaced for the
 * "all" scope, so a progressor / business owner's loose to-do vanished).
 */
jest.mock("@/lib/agent-session", () => ({ hasAdminPowers: jest.fn(() => false), hasSuperAdminPowers: jest.fn(() => false) }));
jest.mock("@/lib/services/activity", () => ({ touchLastActivity: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { manualTask: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), update: jest.fn(), delete: jest.fn() } } }));

import { listInternalSelfAssignedTasks, updateInternalManualTask, deleteInternalManualTask } from "@/lib/services/manual-tasks";
import { prisma } from "@/lib/prisma";
import { TSP_ONLY_TX_WHERE } from "@/lib/security/access-scope";

const p = prisma as any;
const whereOf = () => p.manualTask.findMany.mock.calls.at(-1)![0].where;

beforeEach(() => jest.clearAllMocks());

it("business scope → this business's files, plus the viewer's OWN loose to-dos only", async () => {
  await listInternalSelfAssignedTasks({ kind: "business", businessId: "biz1" }, "u1");
  const w = whereOf();
  expect(w.isInternalSelfAssigned).toBe(true);
  expect(w.OR).toEqual([
    { transaction: { progressionBusinessId: "biz1", isDemo: false } },
    { transactionId: null, createdById: "u1" }, // creator-scoped — no other tenant's loose to-dos
  ]);
});

it("see-own (assigned) scope → the viewer's own files + own loose to-dos", async () => {
  await listInternalSelfAssignedTasks({ kind: "assigned", userId: "u1" }, "u1");
  expect(whereOf().OR).toEqual([
    { transaction: { assignedUserId: "u1", isDemo: false } },
    { transactionId: null, createdById: "u1" },
  ]);
});

it("TSP 'all' scope → TSP-only files + the admin's OWN loose to-dos (never another's)", async () => {
  await listInternalSelfAssignedTasks({ kind: "all" }, "admin1");
  const w = whereOf();
  expect(w.OR).toEqual([
    { transaction: { isDemo: false, ...TSP_ONLY_TX_WHERE } },
    { transactionId: null, createdById: "admin1" },
  ]);
});

// The MUTATION guards bind to the same scope — a business can't edit/delete
// another tenant's internal task (or anyone else's loose to-do) by guessing an id.
describe("internal-task mutation scope guards", () => {
  const findFirstWhere = () => p.manualTask.findFirst.mock.calls.at(-1)![0].where;

  it("updateInternalManualTask binds to the business's own files + own loose to-dos", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(
      updateInternalManualTask("t1", { kind: "business", businessId: "biz1" }, "u1", { title: "x" }),
    ).rejects.toThrow(/not found/i);
    expect(findFirstWhere()).toEqual({
      id: "t1", isInternalSelfAssigned: true,
      OR: [
        { transaction: { progressionBusinessId: "biz1", isDemo: false } },
        { transactionId: null, createdById: "u1" },
      ],
    });
    expect(p.manualTask.update).not.toHaveBeenCalled();
  });

  it("deleteInternalManualTask (see-own) binds to the viewer's own files + own loose to-dos", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(
      deleteInternalManualTask("t1", { kind: "assigned", userId: "u1" }, "u1"),
    ).rejects.toThrow(/not found/i);
    expect(findFirstWhere()).toEqual({
      id: "t1", isInternalSelfAssigned: true,
      OR: [
        { transaction: { assignedUserId: "u1", isDemo: false } },
        { transactionId: null, createdById: "u1" },
      ],
    });
    expect(p.manualTask.delete).not.toHaveBeenCalled();
  });

  it("TSP 'all' delete allows TSP files OR the admin's own loose to-dos", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(deleteInternalManualTask("t1", { kind: "all" }, "admin1")).rejects.toThrow(/not found/i);
    const w = findFirstWhere();
    expect(w.OR).toEqual([
      { transaction: { isDemo: false, ...TSP_ONLY_TX_WHERE } },
      { transactionId: null, createdById: "admin1" },
    ]);
  });
});
