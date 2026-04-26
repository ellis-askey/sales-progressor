// lib/services/reminders.ts — Sprint 3 v2
// Updated engine: graceDays, repeatEveryDays, escalateAfterChases, priority, chaseCount

import { prisma } from "@/lib/prisma";
import type { ReminderLogStatus, ChaseTaskStatus, TaskPriority } from "@prisma/client";
import { createCommunicationRecord } from "@/lib/services/comms";
import type { AgentVisibility } from "@/lib/services/agent";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderLogWithRule = {
  id: string;
  transactionId: string;
  reminderRuleId: string;
  status: ReminderLogStatus;
  nextDueDate: Date;
  snoozedUntil: Date | null;
  sourceDateUsed: Date | null;
  statusReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  reminderRule: {
    id: string;
    name: string;
    description?: string | null;
    targetMilestoneCode: string | null;
    graceDays: number;
    repeatEveryDays: number;
    escalateAfterChases: number;
  };
  chaseTasks: {
    id: string;
    status: ChaseTaskStatus;
    priority: TaskPriority;
    chaseCount: number;
    dueDate: Date;
    communications: { createdAt: Date; method: string | null }[];
  }[];
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getReminderLogsForTransaction(
  transactionId: string,
  agencyId: string
): Promise<ReminderLogWithRule[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  return prisma.reminderLog.findMany({
    where: { transactionId },
    orderBy: { nextDueDate: "asc" },
    include: {
      reminderRule: {
        select: { id: true, name: true, description: true, targetMilestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true },
      },
      chaseTasks: {
        select: {
          id: true, status: true, priority: true, chaseCount: true, dueDate: true,
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, method: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  }) as Promise<ReminderLogWithRule[]>;
}

export async function getAgentReminderLogs(vis: AgentVisibility) {
  const txWhere = vis.seeAll
    ? { agencyId: vis.agencyId, agentUserId: { not: null as string | null }, status: { in: ["active" as const, "on_hold" as const] }, serviceType: { not: "outsourced" as const } }
    : { agencyId: vis.agencyId, agentUserId: vis.userId, status: { in: ["active" as const, "on_hold" as const] }, serviceType: { not: "outsourced" as const } };

  return prisma.reminderLog.findMany({
    where: { status: "active", transaction: txWhere },
    include: {
      reminderRule: {
        select: { name: true, description: true, targetMilestoneCode: true, repeatEveryDays: true, escalateAfterChases: true },
      },
      chaseTasks: {
        where: { status: "pending" },
        select: {
          id: true, status: true, priority: true, chaseCount: true, dueDate: true,
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, method: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          contacts: { select: { id: true, name: true, roleType: true, email: true, phone: true } },
        },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function getChaseTasksForTransaction(transactionId: string, agencyId: string) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  return prisma.chaseTask.findMany({
    where: { transactionId },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    include: {
      reminderLog: {
        include: { reminderRule: { select: { name: true, targetMilestoneCode: true } } },
      },
      assignedTo: { select: { id: true, name: true } },
    },
  });
}

// ─── Core engine ──────────────────────────────────────────────────────────────

export async function evaluateTransactionReminders(transactionId: string) {
  const transaction = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    include: {
      milestoneCompletions: {
        where: { isActive: true },
        include: { milestoneDefinition: true },
      },
    },
  });

  if (!transaction) return;
  if (transaction.status !== "active") return;

  const assignedUserId = transaction.assignedUserId ?? "";

  // Build completion map: milestoneDefinitionId -> completion
  const completionByDefId = new Map(
    transaction.milestoneCompletions.map((c) => [c.milestoneDefinitionId, c])
  );

  // Build completion map by code: code -> completion
  const completionByCode = new Map(
    transaction.milestoneCompletions.map((c) => [c.milestoneDefinition.code, c])
  );

  // Exchange readiness: all blocksExchange milestones complete or not-required
  const allBlockers = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
  });
  const exchangeReady = allBlockers.every((def) => {
    const c = completionByDefId.get(def.id);
    return c && c.isActive;
  });

  // Load all active reminder rules
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    include: { anchorMilestone: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rule of rules) {
    // Exchange-gated: skip if not ready
    if (rule.requiresExchangeReady && !exchangeReady) {
      await deactivateLog(transactionId, rule.id, "Exchange not yet ready", assignedUserId);
      continue;
    }

    // Check if target milestone is already confirmed — if so, deactivate
    if (rule.targetMilestoneCode) {
      const targetCompletion = completionByCode.get(rule.targetMilestoneCode);
      if (targetCompletion && targetCompletion.isActive) {
        await deactivateLog(transactionId, rule.id, "Target milestone confirmed", assignedUserId);
        continue;
      }
    }

    // Determine anchor date
    let anchorDate: Date | null = null;

    if (rule.anchorMilestoneId) {
      const anchorCompletion = completionByDefId.get(rule.anchorMilestoneId);
      if (!anchorCompletion || !anchorCompletion.isActive) {
        await deactivateLog(transactionId, rule.id, "Anchor milestone not yet confirmed", assignedUserId);
        continue;
      }
      anchorDate = (rule.useEventDate && anchorCompletion.eventDate)
        ? anchorCompletion.eventDate
        : anchorCompletion.completedAt;
    } else {
      anchorDate = transaction.createdAt;
    }

    // Calculate first due date: anchor + graceDays
    const firstDueDate = addDays(anchorDate, rule.graceDays);

    // Find existing active log
    const existingLog = await prisma.reminderLog.findFirst({
      where: { transactionId, reminderRuleId: rule.id, status: "active" },
    });

    if (existingLog) {
      // Update if due date shifted significantly (e.g. event_date changed)
      const diff = Math.abs(existingLog.nextDueDate.getTime() - firstDueDate.getTime());
      if (diff > 60 * 60 * 1000) {
        await prisma.reminderLog.update({
          where: { id: existingLog.id },
          data: { nextDueDate: firstDueDate, sourceDateUsed: anchorDate },
        });
        await writeEngineAudit(
          transactionId,
          `Reminder engine: due date updated for "${rule.name}" — new due date ${formatEngineDate(firstDueDate)}.`,
          assignedUserId
        );
      }
    } else {
      await prisma.reminderLog.create({
        data: {
          transactionId,
          reminderRuleId: rule.id,
          status: "active",
          nextDueDate: firstDueDate,
          sourceDateUsed: anchorDate,
        },
      });
      await writeEngineAudit(
        transactionId,
        `Reminder engine: reminder created for "${rule.name}" — due ${formatEngineDate(firstDueDate)}.`,
        assignedUserId
      );
    }

    // Get the current active log
    const log = await prisma.reminderLog.findFirst({
      where: { transactionId, reminderRuleId: rule.id, status: "active" },
    });

    if (!log) continue;

    // Find existing open chase task for this log
    const openTask = await prisma.chaseTask.findFirst({
      where: { reminderLogId: log.id, status: "pending" },
    });

    if (openTask) {
      const taskAge = Math.floor((today.getTime() - openTask.dueDate.getTime()) / 86400000);
      if (taskAge > 0 && taskAge % rule.repeatEveryDays === 0) {
        const newChaseCount = openTask.chaseCount + 1;
        const newPriority: TaskPriority = newChaseCount >= rule.escalateAfterChases ? "escalated" : "normal";
        await prisma.chaseTask.update({
          where: { id: openTask.id },
          data: {
            chaseCount: newChaseCount,
            priority: newPriority,
            dueDate: addDays(openTask.dueDate, rule.repeatEveryDays),
          },
        });
      }
    } else if (log.nextDueDate <= today) {
      await prisma.chaseTask.create({
        data: {
          transactionId,
          reminderLogId: log.id,
          assignedToId: transaction.assignedUserId,
          dueDate: log.nextDueDate,
          status: "pending",
          priority: "normal",
          chaseCount: 0,
        },
      });
      await writeEngineAudit(
        transactionId,
        `Reminder engine: chase task created for "${rule.name}" — due ${formatEngineDate(log.nextDueDate)}.`,
        assignedUserId
      );
    }
  }
}

export async function runReminderEngine(agencyId?: string) {
  const where = agencyId
    ? { status: "active" as const, agencyId }
    : { status: "active" as const };

  const transactions = await prisma.propertyTransaction.findMany({
    where,
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      await evaluateTransactionReminders(tx.id);
      processed++;
    } catch (err) {
      console.error(`Error evaluating transaction ${tx.id}:`, err);
      errors++;
    }
  }

  return { processed, errors, total: transactions.length };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatEngineDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function writeEngineAudit(transactionId: string, content: string, createdById: string) {
  if (!createdById) return;
  await prisma.communicationRecord.create({
    data: { transactionId, type: "internal_note", contactIds: [], content, createdById },
  });
}

async function deactivateLog(
  transactionId: string,
  reminderRuleId: string,
  reason: string,
  assignedUserId: string
) {
  const existing = await prisma.reminderLog.findFirst({
    where: { transactionId, reminderRuleId, status: "active" },
    include: { reminderRule: { select: { name: true } } },
  });
  if (!existing) return;

  await prisma.reminderLog.update({
    where: { id: existing.id },
    data: { status: "inactive", statusReason: reason },
  });

  const deactivatedTasks = await prisma.chaseTask.updateMany({
    where: { reminderLogId: existing.id, status: "pending" },
    data: { status: "inactive" },
  });

  const taskNote = deactivatedTasks.count > 0 ? ` Chase task also deactivated.` : "";
  await writeEngineAudit(
    transactionId,
    `Reminder engine: reminder deactivated for "${existing.reminderRule.name}" — ${reason}.${taskNote}`,
    assignedUserId
  );
}

// ─── Task actions ─────────────────────────────────────────────────────────────

export async function completeChaseTask(taskId: string, agencyId: string) {
  const task = await prisma.chaseTask.findFirst({
    where: { id: taskId, transaction: { agencyId } },
    select: { id: true, reminderLogId: true },
  });
  if (!task) throw new Error("Task not found");

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "done" },
  });

  await prisma.reminderLog.update({
    where: { id: task.reminderLogId },
    data: { status: "completed", statusReason: "Chase task marked done" },
  });
}

export async function cancelChaseTask(taskId: string, agencyId: string) {
  const task = await prisma.chaseTask.findFirst({
    where: { id: taskId, transaction: { agencyId } },
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "cancelled" },
  });
}

export async function snoozeReminderLog(taskId: string, snoozeHours: number, agencyId: string) {
  const task = await prisma.chaseTask.findFirst({
    where: { id: taskId, transaction: { agencyId } },
    select: { id: true, reminderLogId: true },
  });
  if (!task) throw new Error("Task not found");

  const snoozedUntil = new Date(Date.now() + snoozeHours * 60 * 60 * 1000);

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "cancelled" },
  });

  await prisma.reminderLog.update({
    where: { id: task.reminderLogId },
    data: { snoozedUntil, nextDueDate: snoozedUntil },
  });
}

export async function wakeUpReminderLog(logId: string, agencyId: string) {
  const log = await prisma.reminderLog.findFirst({
    where: { id: logId, transaction: { agencyId } },
    select: { id: true },
  });
  if (!log) throw new Error("Reminder log not found");

  await prisma.reminderLog.update({
    where: { id: logId },
    data: { snoozedUntil: null, nextDueDate: new Date() },
  });
}

export async function autoCompleteRemindersForMilestone(
  transactionId: string,
  milestoneCode: string
) {
  const logs = await prisma.reminderLog.findMany({
    where: {
      transactionId,
      status: "active",
      reminderRule: { targetMilestoneCode: milestoneCode },
    },
    select: { id: true },
  });
  if (logs.length === 0) return;

  const logIds = logs.map((l) => l.id);

  await prisma.chaseTask.updateMany({
    where: { reminderLogId: { in: logIds }, status: "pending" },
    data: { status: "cancelled" },
  });

  await prisma.reminderLog.updateMany({
    where: { id: { in: logIds } },
    data: { status: "completed", statusReason: "Milestone completed" },
  });
}
