import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { touchLastActivity } from "@/lib/services/activity";
import { toUKDateStr } from "@/lib/utils";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";

export type ManualTaskWithRelations = {
  id: string;
  title: string;
  notes: string | null;
  progressorNote: string | null;
  progressorNoteAt: Date | null;
  status: "open" | "done";
  completedAt?: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  isAgentRequest: boolean;
  isInternalSelfAssigned: boolean;
  isReview: boolean;
  isPossible: boolean;
  transactionId: string | null;
  transaction: { propertyAddress: string; photoStoragePath: string | null } | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
};

export async function listManualTasks(agencyId: string, status?: "open" | "done") {
  return prisma.manualTask.findMany({
    where: { agencyId, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

export async function listManualTasksForTransaction(transactionId: string, agencyId: string | null) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  // Internal-self-assigned tasks are NEVER returned by this list — agents
  // (director/negotiator) call this function with their agency id and
  // would see SP/admin internal notes leak into their "To-Do" card
  // otherwise. Internal staff still get those tasks via the dedicated
  // listInternalSelfAssignedTasksForTransaction call, which both
  // file-detail page-level fetches run in parallel for SP/admin viewers.
  return prisma.manualTask.findMany({
    where: { transactionId, isInternalSelfAssigned: false },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

export async function createManualTask(data: {
  agencyId: string | null;
  createdById: string;
  title: string;
  notes?: string;
  transactionId?: string;
  assignedToId?: string;
  dueDate?: string;
  isAgentRequest?: boolean;
  isInternalSelfAssigned?: boolean;
  // Marks a deliberate "come back on the due date" review (surfaced in the
  // Reviews-due section on /agent/to-do). See lib/services/reviews.ts.
  isReview?: boolean;
  // Provenance for auto-created tasks (e.g. the WhatsApp "Promises" scan).
  sourceMessageId?: string;
  // A "possible promise" from the WhatsApp scan — undated or the model was
  // unsure. Lives in the folded pile on the file's To-Do tab, never the main
  // list, until promoted (flag cleared + due date set) or dismissed (deleted).
  isPossible?: boolean;
}) {
  const task = await prisma.manualTask.create({
    data: {
      agencyId: data.agencyId,
      createdById: data.createdById,
      title: data.title,
      notes: data.notes ?? null,
      transactionId: data.transactionId ?? null,
      assignedToId: data.assignedToId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isAgentRequest: data.isAgentRequest ?? false,
      isInternalSelfAssigned: data.isInternalSelfAssigned ?? false,
      isReview: data.isReview ?? false,
      isPossible: data.isPossible ?? false,
      sourceMessageId: data.sourceMessageId ?? null,
    },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (data.transactionId) touchLastActivity(data.transactionId).catch(() => {});
  return task;
}

// Bound an internal-self-assigned-task query to the viewer's book — the SAME
// isolation boundary as TSP_ONLY_TX_WHERE. "all" (TSP admin) sees TSP's own files
// plus general (no-transaction) internal tasks; a business / see-own viewer sees
// only tasks on transactions in their scope. Shared by the list AND the
// update/delete ownership guards, so a business can never read, edit or delete
// another tenant's (or TSP's) internal task by guessing an id.
// A linked internal to-do is scoped to the viewer's book (via its transaction).
// An UNLINKED one (no property) has no agency/business to scope by, so it belongs
// to whoever created it — every role sees their own, and nothing leaks between
// businesses or between TSP and a customer (critique #300). Previously only the
// "all" (admin) scope surfaced unlinked to-dos, so a progressor / business
// owner's loose to-do vanished on refresh.
function internalTaskScopeWhere(scope: AccessScope, viewerId: string): Prisma.ManualTaskWhereInput {
  return {
    OR: [
      { transaction: scopeTransactionWhere(scope) },
      { transactionId: null, createdById: viewerId },
    ],
  };
}

// Internal-staff self-assigned to-dos, SCOPED to the viewer's book (+ their own
// unlinked ones). Used by the third bucket on /agent/to-do and the nav badge.
export async function listInternalSelfAssignedTasks(scope: AccessScope, viewerId: string): Promise<ManualTaskWithRelations[]> {
  return prisma.manualTask.findMany({
    // isPossible excluded: possible promises wait in the file-tab pile only.
    where: { isInternalSelfAssigned: true, isPossible: false, ...internalTaskScopeWhere(scope, viewerId) },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

export async function listInternalSelfAssignedTasksForTransaction(transactionId: string): Promise<ManualTaskWithRelations[]> {
  return prisma.manualTask.findMany({
    where: { isInternalSelfAssigned: true, isPossible: false, transactionId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

// Possible promises from the WhatsApp scan, for the folded pile on a file's
// To-Do tab (internal viewers only — possibles are always internal-self-
// assigned while the founder test gate is on).
export async function listPossiblePromisesForTransaction(transactionId: string): Promise<ManualTaskWithRelations[]> {
  return prisma.manualTask.findMany({
    where: { isInternalSelfAssigned: true, isPossible: true, status: "open", transactionId },
    orderBy: { createdAt: "desc" },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

// Mutation helper for internal tasks. The caller (action) role-gates to internal
// staff; this additionally binds the task to the caller's AccessScope so an
// external business can only edit internal tasks on its OWN files — never TSP's
// or another business's (the role gate alone is insufficient now that external
// progressors are "internal staff").
export async function updateInternalManualTask(
  id: string,
  scope: AccessScope,
  viewerId: string,
  data: Partial<{ title: string; notes: string | null; status: "open" | "done"; dueDate: string | null; isPossible: boolean }>
) {
  const task = await prisma.manualTask.findFirst({
    where: { id, isInternalSelfAssigned: true, ...internalTaskScopeWhere(scope, viewerId) },
  });
  if (!task) throw new Error("Task not found");

  const updated = await prisma.manualTask.update({
    where: { id },
    data: {
      ...(data.status  !== undefined && { status: data.status, completedAt: data.status === "done" ? new Date() : null }),
      ...(data.title   !== undefined && { title: data.title }),
      ...(data.notes   !== undefined && { notes: data.notes }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.isPossible !== undefined && { isPossible: data.isPossible }),
    },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (task.transactionId) touchLastActivity(task.transactionId).catch(() => {});
  return updated;
}

export async function deleteInternalManualTask(id: string, scope: AccessScope, viewerId: string) {
  const task = await prisma.manualTask.findFirst({
    where: { id, isInternalSelfAssigned: true, ...internalTaskScopeWhere(scope, viewerId) },
  });
  if (!task) throw new Error("Task not found");
  await prisma.manualTask.delete({ where: { id } });
}

export async function updateManualTask(
  id: string,
  agencyId: string,
  data: Partial<{ title: string; notes: string | null; progressorNote: string | null; status: "open" | "done"; assignedToId: string; dueDate: string | null }>
) {
  const task = await prisma.manualTask.findFirst({ where: { id, agencyId } });
  if (!task) throw new Error("Task not found");

  const updated = await prisma.manualTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.progressorNote !== undefined && {
        progressorNote: data.progressorNote,
        progressorNoteAt: data.progressorNote ? new Date() : null,
      }),
      ...(data.status !== undefined && { status: data.status, completedAt: data.status === "done" ? new Date() : null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (task.transactionId) touchLastActivity(task.transactionId).catch(() => {});
  return updated;
}

export async function deleteManualTask(id: string, agencyId: string) {
  const task = await prisma.manualTask.findFirst({ where: { id, agencyId } });
  if (!task) throw new Error("Task not found");
  await prisma.manualTask.delete({ where: { id } });
}

export async function countOpenManualTasks(agencyId: string) {
  return prisma.manualTask.count({ where: { agencyId, status: "open" } });
}

export async function listAgentRequests(userId: string, agencyId: string) {
  return prisma.manualTask.findMany({
    where: { agencyId, isAgentRequest: true, createdById: userId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

/** All tasks created by the agent — both their own and requests to the progressor. */
export async function listAllTasksForAgent(userId: string, agencyId: string) {
  return prisma.manualTask.findMany({
    where: { agencyId, createdById: userId },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

/** Agent requests visible to a sales_progressor — open-only, v1. */
export async function listProgressorInboxTasks(progressorId: string) {
  return prisma.manualTask.findMany({
    where: {
      isAgentRequest: true,
      status: "open",
      // A sale-attached note rides its sale's assignment; a general (no-sale) note
      // is addressed to a person via assignedToId — include both, or general notes
      // reach nobody (audit V1).
      OR: [
        { transaction: { assignedUserId: progressorId } },
        { assignedToId: progressorId },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

/** Update a task owned by a sales_progressor (own note OR agent inbox request). */
export async function updateManualTaskAsProgressor(
  id: string,
  progressorId: string,
  data: Partial<{ title: string; notes: string | null; status: "open" | "done"; dueDate: string | null }>
) {
  const task = await prisma.manualTask.findFirst({
    where: {
      id,
      OR: [
        { createdById: progressorId, isAgentRequest: false },
        { isAgentRequest: true, transaction: { assignedUserId: progressorId } },
        { isAgentRequest: true, assignedToId: progressorId }, // general (no-sale) note (audit V1)
      ],
    },
  });
  if (!task) throw new Error("Task not found");

  const updated = await prisma.manualTask.update({
    where: { id },
    data: {
      ...(data.status    !== undefined && { status: data.status, completedAt: data.status === "done" ? new Date() : null }),
      ...(data.title     !== undefined && { title: data.title }),
      ...(data.notes     !== undefined && { notes: data.notes }),
      ...(data.dueDate   !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      transaction: { select: { propertyAddress: true, photoStoragePath: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (task.transactionId) touchLastActivity(task.transactionId).catch(() => {});
  return updated;
}

/**
 * Count of the agent/internal user's OPEN to-dos that are due today or overdue.
 * Feeds the To-Do nav badge. Mirrors the /agent/to-do page's task assembly
 * exactly (own agency tasks + progressor inbox + internal self-assigned) so the
 * badge and the list never disagree.
 */
export async function countAgentDueOrOverdue(userId: string, agencyId: string | null, role: string, scope: AccessScope): Promise<number> {
  const isProgressor = role === "sales_progressor";
  const isInternal = isProgressor || role === "admin" || role === "superadmin";
  const [own, inbox, internal] = await Promise.all([
    agencyId ? listAllTasksForAgent(userId, agencyId) : Promise.resolve([]),
    isProgressor ? listProgressorInboxTasks(userId) : Promise.resolve([]),
    isInternal ? listInternalSelfAssignedTasks(scope, userId) : Promise.resolve([]),
  ]);
  const todayStr = toUKDateStr(new Date());
  const seen = new Set<string>();
  let n = 0;
  for (const t of [...own, ...inbox, ...internal]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (t.status === "open" && t.dueDate && toUKDateStr(t.dueDate) <= todayStr) n++;
  }
  return n;
}

export async function countManualTasksDueToday(agencyId: string) {
  const now = new Date();
  const todayStr = toUKDateStr(now);
  // Generous DB window — precise filter in JS using UK date string.
  const windowStart = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 26 * 60 * 60 * 1000);
  const tasks = await prisma.manualTask.findMany({
    where: {
      agencyId,
      status: "open",
      dueDate: { gte: windowStart, lt: windowEnd },
    },
    select: { dueDate: true },
  });
  return tasks.filter((t) => t.dueDate && toUKDateStr(t.dueDate) === todayStr).length;
}
