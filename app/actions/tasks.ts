"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { completeChaseTask, snoozeReminderLog, wakeUpReminderLog, runReminderEngine } from "@/lib/services/reminders";
import { prisma } from "@/lib/prisma";

export async function completeTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  await completeChaseTask(taskId, session.user.agencyId);
  revalidatePath(pathname, "page");
}

export async function snoozeTaskAction(taskId: string, snoozeHours: number, pathname: string) {
  const session = await requireSession();
  await snoozeReminderLog(taskId, snoozeHours, session.user.agencyId);
  revalidatePath(pathname, "page");
}

export async function wakeupReminderAction(logId: string, pathname: string) {
  const session = await requireSession();
  await wakeUpReminderLog(logId, session.user.agencyId);
  revalidatePath(pathname, "page");
}

export async function escalateTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  const task = await prisma.chaseTask.findFirst({
    where: { id: taskId, transaction: { agencyId: session.user.agencyId } },
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");
  await prisma.chaseTask.update({ where: { id: taskId }, data: { priority: "escalated" } });
  revalidatePath(pathname, "page");
}

export async function runReminderEngineAction(pathname: string) {
  const session = await requireSession();
  await runReminderEngine(session.user.agencyId);
  revalidatePath(pathname, "page");
}

export async function getTransactionReminderCountAction(transactionId: string): Promise<number> {
  const session = await requireSession();
  return prisma.reminderLog.count({
    where: { transactionId, transaction: { agencyId: session.user.agencyId } },
  });
}
