"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeChaseTaskWhere, scopeReminderLogWhere } from "@/lib/security/access-scope";
import { completeChaseTask, advanceChaseTask, snoozeReminderLog, wakeUpReminderLog, runReminderEngine, evaluateTransactionReminders } from "@/lib/services/reminders";
import { completeMilestone } from "@/lib/services/milestones";
import { prisma } from "@/lib/prisma";
import { touchLastActivity } from "@/lib/services/activity";

export async function completeTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  const { transactionId, reminderLogId, targetMilestoneCode } = await completeChaseTask(
    taskId,
    getAccessScope(session),
  );

  if (targetMilestoneCode) {
    const def = await prisma.milestoneDefinition.findUnique({
      where: { code: targetMilestoneCode },
      select: { id: true },
    });
    if (def) {
      try {
        await completeMilestone({
          transactionId,
          milestoneDefinitionId: def.id,
          completedById: session.user.id,
          completedByName: session.user.name ?? "",
        });
        // completeMilestone auto-closes the reminder log via autoCompleteRemindersForMilestone
      } catch (err) {
        // Prerequisite not met or already complete — close reminder log directly as fallback
        await prisma.reminderLog.update({
          where: { id: reminderLogId },
          data: { status: "completed", statusReason: "Chase task marked done" },
        }).catch(() => {});
        console.error("[completeTaskAction] completeMilestone failed:", err);
      }
    }
  }

  // Activate any downstream reminders whose anchor milestone just completed
  void evaluateTransactionReminders(transactionId).catch(console.error);
  revalidatePath(pathname, "page");
}

export async function snoozeTaskAction(taskId: string, snoozeHours: number, pathname: string) {
  const session = await requireSession();
  await snoozeReminderLog(taskId, snoozeHours, getAccessScope(session));
  revalidatePath(pathname, "page");
}

export async function wakeupReminderAction(logId: string, pathname: string) {
  const session = await requireSession();
  await wakeUpReminderLog(logId, getAccessScope(session));
  revalidatePath(pathname, "page");
}

export async function advanceChaseTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  await advanceChaseTask(taskId, getAccessScope(session));
  revalidatePath(pathname, "page");
}

export async function recordManualChaseAction(taskId: string, pathname: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: { id: true, chaseCount: true, transactionId: true },
  });
  if (!task) throw new Error("Task not found");
  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { chaseCount: task.chaseCount + 1 },
  });
  await prisma.outboundMessage.create({
    data: {
      transactionId: task.transactionId,
      chaseTaskId: taskId,
      createdById: session.user.id,
      type: "outbound",
      contactIds: [],
      content: "Chased manually (recorded by agent)",
    },
  });
  touchLastActivity(task.transactionId).catch(() => {});
  revalidatePath(pathname, "page");
}

export async function escalateTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");
  await prisma.chaseTask.update({ where: { id: taskId }, data: { priority: "escalated" } });
  revalidatePath(pathname, "page");
}

export async function runReminderEngineAction(pathname: string) {
  const session = await requireSession();
  if (session.user.role === "sales_progressor") {
    await runReminderEngine(undefined, session.user.id);
  } else {
    await runReminderEngine(session.user.agencyId || undefined);
  }
  revalidatePath(pathname, "page");
}

export async function getTransactionReminderCountAction(transactionId: string): Promise<number> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scope.kind === "all"
    ? { transactionId }
    : scope.kind === "assigned"
    ? { transactionId, transaction: { assignedUserId: scope.userId } }
    : { transactionId, transaction: { agencyId: scope.agencyIds[0] } };
  return prisma.reminderLog.count({ where: { ...where, chaseTasks: { some: { status: "pending" } } } });
}
