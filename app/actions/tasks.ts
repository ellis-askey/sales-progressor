"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { completeChaseTask, snoozeReminderLog, wakeUpReminderLog } from "@/lib/services/reminders";
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

export async function getTransactionReminderCountAction(transactionId: string): Promise<number> {
  const session = await requireSession();
  return prisma.reminderLog.count({
    where: { transactionId, transaction: { agencyId: session.user.agencyId } },
  });
}
