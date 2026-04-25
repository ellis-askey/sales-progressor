import { prisma } from "@/lib/prisma";

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

export async function listManualTasksForTransaction(transactionId: string, agencyId: string) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
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
  agencyId: string;
  createdById: string;
  title: string;
  notes?: string;
  transactionId?: string;
  assignedToId?: string;
  dueDate?: string;
  isAgentRequest?: boolean;
}) {
  return prisma.manualTask.create({
    data: {
      agencyId: data.agencyId,
      createdById: data.createdById,
      title: data.title,
      notes: data.notes ?? null,
      transactionId: data.transactionId ?? null,
      assignedToId: data.assignedToId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isAgentRequest: data.isAgentRequest ?? false,
    },
    include: {
      transaction: { select: { propertyAddress: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateManualTask(
  id: string,
  agencyId: string,
  data: Partial<{ title: string; notes: string | null; progressorNote: string | null; status: "open" | "done"; assignedToId: string; dueDate: string | null }>
) {
  const task = await prisma.manualTask.findFirst({ where: { id, agencyId } });
  if (!task) throw new Error("Task not found");

  return prisma.manualTask.update({
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

export async function countManualTasksDueToday(agencyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return prisma.manualTask.count({
    where: {
      agencyId,
      status: "open",
      dueDate: { gte: today, lt: tomorrow },
    },
  });
}
