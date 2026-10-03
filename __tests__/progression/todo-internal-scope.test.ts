/**
 * @jest-environment node
 *
 * Phase 3 PR A — the To-Do internal-task leak fix. listInternalSelfAssignedTasks
 * previously queried ALL isInternalSelfAssigned tasks with no scoping, so an
 * external progression business saw TSP's and every other business's internal
 * tasks (and their addresses), and vice versa. It now bounds the query to the
 * viewer's access scope — the same isolation boundary as TSP_ONLY_TX_WHERE.
 */
jest.mock("@/lib/agent-session", () => ({ hasAdminPowers: jest.fn(() => false) }));
jest.mock("@/lib/services/activity", () => ({ touchLastActivity: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { manualTask: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), update: jest.fn(), delete: jest.fn() } } }));

import { listInternalSelfAssignedTasks, updateInternalManualTask, deleteInternalManualTask } from "@/lib/services/manual-tasks";
import { prisma } from "@/lib/prisma";
import { TSP_ONLY_TX_WHERE } from "@/lib/security/access-scope";

const p = prisma as any;
const whereOf = () => p.manualTask.findMany.mock.calls.at(-1)![0].where;

beforeEach(() => jest.clearAllMocks());

it("business scope → only this business's files (no OR, no other business)", async () => {
  await listInternalSelfAssignedTasks({ kind: "business", businessId: "biz1" });
  const w = whereOf();
  expect(w.isInternalSelfAssigned).toBe(true);
  expect(w.transaction).toEqual({ progressionBusinessId: "biz1", isDemo: false });
  expect(w.OR).toBeUndefined();
});

it("see-own (assigned) scope → only the viewer's own files", async () => {
  await listInternalSelfAssignedTasks({ kind: "assigned", userId: "u1" });
  expect(whereOf().transaction).toEqual({ assignedUserId: "u1", isDemo: false });
});

it("TSP 'all' scope → TSP-only files (never external), plus general no-tx tasks", async () => {
  await listInternalSelfAssignedTasks({ kind: "all" });
  const w = whereOf();
  expect(Array.isArray(w.OR)).toBe(true);
  // One branch is the TSP-only transaction filter; the other is no-transaction.
  expect(w.OR).toEqual([
    { transaction: { isDemo: false, ...TSP_ONLY_TX_WHERE } },
    { transactionId: null },
  ]);
});

// The MUTATION guards must bind to the same scope so a business can't edit/delete
// another tenant's internal task by guessing an id (the capstone security fix).
describe("internal-task mutation scope guards", () => {
  const findFirstWhere = () => p.manualTask.findFirst.mock.calls.at(-1)![0].where;

  it("updateInternalManualTask binds to the business's own files", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(
      updateInternalManualTask("t1", { kind: "business", businessId: "biz1" }, { title: "x" }),
    ).rejects.toThrow(/not found/i);
    expect(findFirstWhere()).toEqual({
      id: "t1", isInternalSelfAssigned: true,
      transaction: { progressionBusinessId: "biz1", isDemo: false },
    });
    expect(p.manualTask.update).not.toHaveBeenCalled();
  });

  it("deleteInternalManualTask (see-own) binds to the viewer's own files", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(
      deleteInternalManualTask("t1", { kind: "assigned", userId: "u1" }),
    ).rejects.toThrow(/not found/i);
    expect(findFirstWhere()).toEqual({
      id: "t1", isInternalSelfAssigned: true,
      transaction: { assignedUserId: "u1", isDemo: false },
    });
    expect(p.manualTask.delete).not.toHaveBeenCalled();
  });

  it("TSP 'all' delete allows TSP files OR general no-tx tasks", async () => {
    p.manualTask.findFirst.mockResolvedValueOnce(null);
    await expect(deleteInternalManualTask("t1", { kind: "all" })).rejects.toThrow(/not found/i);
    const w = findFirstWhere();
    expect(w.OR).toEqual([
      { transaction: { isDemo: false, ...TSP_ONLY_TX_WHERE } },
      { transactionId: null },
    ]);
  });
});
