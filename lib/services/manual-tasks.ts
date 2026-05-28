import { prisma } from "@/lib/prisma";
import { touchLastActivity } from "@/lib/services/activity";
import { toUKDateStr } from "@/lib/utils";

export type ManualTaskWithRelations = {
  id: string;
  title: string;
  notes: string | null;
  progressorNote: string | null;
  progressorNoteAt: Date | null;
  status: "open" | "done";
  dueDate: Date | null;
  createdAt: Date;
  isAgentRequest: boolean;
  isInternalSelfAssigned: boolean;
  transactionId: string | null;
  transaction: { propertyAddress: string } | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
};

export async function listManualTasks(agencyId: string, status?: "open" | "done") {
  return prisma.manualTask.findMany({
    where: { agencyId, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true } },
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

  return prisma.manualTask.findMany({
    where: { transactionId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      transaction: { select: { propertyAddress: true } },
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
    },
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (data.transactionId) touchLastActivity(data.transactionId).catch(() => {});
  return task;
}

// Internal-staff self-assigned to-dos — visible to all internal staff,
// regardless of creator. Used by the third bucket on /agent/to-do and on
// the property-file To-Do tab when viewed by internal staff.
export async function listInternalSelfAssignedTasks(): Promise<ManualTaskWithRelations[]> {
  return prisma.manualTask.findMany({
    where: { isInternalSelfAssigned: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

export async function listInternalSelfAssignedTasksForTransaction(transactionId: string): Promise<ManualTaskWithRelations[]> {
  return prisma.manualTask.findMany({
    where: { isInternalSelfAssigned: true, transactionId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<ManualTaskWithRelations[]>;
}

// Mutation helper for internal tasks — ownership shape is role-based
// (any internal staff member can touch any internal task), not
// agencyId-based. The API route is responsible for the role check
// before calling this.
export async function updateInternalManualTask(
  id: string,
  data: Partial<{ title: string; notes: string | null; status: "open" | "done"; dueDate: string | null }>
) {
  const task = await prisma.manualTask.findFirst({
    where: { id, isInternalSelfAssigned: true },
  });
  if (!task) throw new Error("Task not found");

  const updated = await prisma.manualTask.update({
    where: { id },
    data: {
      ...(data.status  !== undefined && { status: data.status }),
      ...(data.title   !== undefined && { title: data.title }),
      ...(data.notes   !== undefined && { notes: data.notes }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (task.transactionId) touchLastActivity(task.transactionId).catch(() => {});
  return updated;
}

export async function deleteInternalManualTask(id: string) {
  const task = await prisma.manualTask.findFirst({
    where: { id, isInternalSelfAssigned: true },
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
      ...(data.status !== undefined && { status: data.status }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      transaction: { select: { propertyAddress: true } },
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
      transaction: { select: { propertyAddress: true } },
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
      transaction: { select: { propertyAddress: true } },
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
      transaction: { assignedUserId: progressorId },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: { select: { propertyAddress: true } },
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
      ],
    },
  });
  if (!task) throw new Error("Task not found");

  const updated = await prisma.manualTask.update({
    where: { id },
    data: {
      ...(data.status    !== undefined && { status: data.status }),
      ...(data.title     !== undefined && { title: data.title }),
      ...(data.notes     !== undefined && { notes: data.notes }),
      ...(data.dueDate   !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (task.transactionId) touchLastActivity(task.transactionId).catch(() => {});
  return updated;
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
