// lib/services/tasks.ts
// Sprint 4: Work queue queries.
// Sprint 7: Added contacts to transaction include for ChaseDrawer context.

import { prisma } from "@/lib/prisma";

export type WorkQueueTask = {
  id: string;
  status: string;
  priority: string;
  chaseCount: number;
  dueDate: Date;
  createdAt: Date;
  transaction: {
    id: string;
    propertyAddress: string;
    assignedUserId: string | null;
    assignedUser: { id: string; name: string } | null;
    contacts: Array<{ id: string; name: string; roleType: string; email: string | null; phone: string | null }>;
  };
  reminderLog: {
    reminderRule: {
      name: string;
      targetMilestoneCode: string | null;
      repeatEveryDays: number;
      escalateAfterChases: number;
    };
  };
  assignedTo: { id: string; name: string } | null;
};

export type WorkQueueCounts = {
  total: number;
  pending: number;
  overdue: number;
  escalated: number;
  mine: number;
  snoozed: number;
};

export type SnoozedItem = {
  id: string;
  snoozedUntil: Date;
  transaction: { id: string; propertyAddress: string };
  reminderRule: { name: string; targetMilestoneCode: string | null };
};

export async function getWorkQueueTasks(
  agencyId: string,
  options: {
    assignedToId?: string;
    statusFilter?: "all" | "pending" | "overdue" | "escalated" | "done";
    includeCompleted?: boolean;
  } = {}
): Promise<WorkQueueTask[]> {
  const { assignedToId, statusFilter = "all", includeCompleted = false } = options;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const statusIn = includeCompleted
    ? ["pending", "done", "cancelled"]
    : ["pending"];

  const tasks = await prisma.chaseTask.findMany({
    where: {
      status: { in: statusIn as ("pending" | "done" | "cancelled" | "inactive")[] },
      transaction: { agencyId, status: "active", progressedBy: "progressor" },
      ...(assignedToId ? { assignedToId } : {}),
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    include: {
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          assignedUserId: true,
          assignedUser: { select: { id: true, name: true } },
          contacts: {
            select: { id: true, name: true, roleType: true, email: true, phone: true },
          },
        },
      },
      reminderLog: {
        include: {
          reminderRule: {
            select: {
              name: true,
              targetMilestoneCode: true,
              repeatEveryDays: true,
              escalateAfterChases: true,
            },
          },
        },
      },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return tasks.filter((task) => {
    if (statusFilter === "overdue") return new Date(task.dueDate) < now && task.status === "pending";
    if (statusFilter === "escalated") return task.priority === "escalated" && task.status === "pending";
    if (statusFilter === "pending") return task.status === "pending";
    if (statusFilter === "done") return task.status === "done" || task.status === "cancelled";
    return true;
  }) as unknown as WorkQueueTask[];
}

export async function getWorkQueueCounts(agencyId: string, userId: string, agentUserId?: string): Promise<WorkQueueCounts> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const txFilter = agentUserId
    ? { agencyId, status: "active" as const, agentUserId }
    : { agencyId, status: "active" as const, progressedBy: "progressor" as const };

  const [allPending, snoozedCount] = await Promise.all([
    prisma.chaseTask.findMany({
      where: { status: "pending", transaction: txFilter },
      select: { id: true, priority: true, dueDate: true, assignedToId: true },
    }),
    prisma.reminderLog.count({
      where: {
        status: "active",
        snoozedUntil: { gt: new Date() },
        transaction: txFilter,
      },
    }),
  ]);

  return {
    total: allPending.length,
    pending: allPending.length,
    overdue: allPending.filter((t) => new Date(t.dueDate) < now).length,
    escalated: allPending.filter((t) => t.priority === "escalated").length,
    mine: allPending.filter((t) => t.assignedToId === userId).length,
    snoozed: snoozedCount,
  };
}

export async function getSnoozedWorkQueueItems(agencyId: string): Promise<SnoozedItem[]> {
  const now = new Date();
  const items = await prisma.reminderLog.findMany({
    where: {
      status: "active",
      snoozedUntil: { gt: now },
      transaction: { agencyId, status: "active" },
    },
    orderBy: { snoozedUntil: "asc" },
    select: {
      id: true,
      snoozedUntil: true,
      transaction: { select: { id: true, propertyAddress: true } },
      reminderRule: { select: { name: true, targetMilestoneCode: true } },
    },
  });
  return items as SnoozedItem[];
}
