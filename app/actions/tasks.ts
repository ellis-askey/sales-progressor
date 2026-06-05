"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeChaseTaskWhere, scopeReminderLogWhere } from "@/lib/security/access-scope";
import { completeChaseTask, advanceChaseTask, snoozeReminderLog, wakeUpReminderLog, runReminderEngine, evaluateTransactionReminders } from "@/lib/services/reminders";
import { completeMilestone } from "@/lib/services/milestones";
import { prisma } from "@/lib/prisma";
import { touchLastActivity } from "@/lib/services/activity";
import { pushChaseEscalation } from "@/lib/agent/push-events";

export type CompleteTaskResult =
  | { ok: true }
  | {
      blocked: true;
      reason: "prerequisites_not_complete";
      // Caller surfaces these to the user via a toast so they know
      // exactly which earlier milestone needs confirming first.
      missing: { code: string; name: string }[];
    };

export async function completeTaskAction(
  taskId: string,
  pathname: string,
): Promise<CompleteTaskResult> {
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
          confirmer: { kind: "user", id: session.user.id, name: session.user.name ?? "" },
        });
        // completeMilestone auto-closes the reminder log via autoCompleteRemindersForMilestone
      } catch (err) {
        const e = err as Error & { missing?: { code: string; name: string }[] };
        if (e.message === "PREREQUISITES_NOT_COMPLETE") {
          // Caller can't confirm yet because an earlier milestone is
          // still outstanding. Do NOT force-close the reminder log —
          // that was the old behaviour and it caused the regen loop
          // (engine immediately created a fresh log on next eval).
          // Instead, leave the log active; the engine's new prereq gate
          // (lib/services/reminders.ts) will deactivate it on this same
          // eval pass since the prereqs are still unmet. Return
          // structured so the UI can toast the reason.
          void evaluateTransactionReminders(transactionId).catch(console.error);
          revalidatePath(pathname, "page");
          return {
            blocked: true,
            reason: "prerequisites_not_complete",
            missing: e.missing ?? [],
          };
        }
        // Any other error: keep the original fallback — close the log so
        // the row doesn't loop. Real errors are rare; this preserves
        // existing recovery behaviour.
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
  return { ok: true };
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
    data: {
      chaseCount: task.chaseCount + 1,
      lastChasedAt: new Date(),
      priority: "normal",
    },
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
    select: {
      id: true,
      priority: true,
      transactionId: true,
      reminderLog: { select: { reminderRule: { select: { name: true } } } },
    },
  });
  if (!task) throw new Error("Task not found");
  const wasEscalated = task.priority === "escalated";
  await prisma.chaseTask.update({ where: { id: taskId }, data: { priority: "escalated" } });

  // Fire push only on the transition non-escalated -> escalated.
  if (!wasEscalated) {
    const milestoneLabel = task.reminderLog?.reminderRule?.name?.replace(/^Chase:\s*/i, "") ?? null;
    pushChaseEscalation(task.transactionId, milestoneLabel).catch(() => {});
  }

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
