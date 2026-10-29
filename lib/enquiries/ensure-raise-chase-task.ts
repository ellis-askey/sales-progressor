// Provision (or reuse) a PM14 chase task so the polished ChaseDrawer can drive
// the manual enquiries chase. ChaseDrawer's send, Generate and logging all run
// on a chaseTaskId; the enquiries chase was deliberately moved off the chase-
// task rails (PM14 rule inactive, its tasks cancelled — see migration
// 20260815260000_enquiries_agent_reminders_off), so there is no task to use.
//
// This mints one, but keeps it INVISIBLE to the work queue: the backing
// ReminderLog is created `cancelled`, so getAgentReminderLogs (which filters
// status:"active") never surfaces it as its own reminder row, and the PM14 rule
// stays inactive so the cron never auto-chases it. The task exists purely as the
// rail the drawer's native send runs on. The escalation's own ledger
// (EnquiryRaiseChase) stays the source of truth for the nudge count + re-arm,
// stamped on send via markRaiseChased.

import { prisma } from "@/lib/prisma";

export async function ensureRaiseChaseTask(
  transactionId: string,
  seed: { buyerRoundId: string | null; assignedUserId: string | null; nudgeCount: number },
): Promise<string | null> {
  // Reuse an existing PM14 chase task on this file if one is around (the
  // enquiries-off migration cancelled the old ones, but the id still works).
  const existing = await prisma.chaseTask.findFirst({
    where: { transactionId, reminderLog: { is: { reminderRule: { is: { targetMilestoneCode: "PM14" } } } } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const rule = await prisma.reminderRule.findFirst({
    where: { targetMilestoneCode: "PM14" },
    select: { id: true },
  });
  if (!rule) return null;

  const now = new Date();
  const log = await prisma.reminderLog.create({
    data: {
      transactionId,
      reminderRuleId: rule.id,
      status: "cancelled", // invisible to the work queue; the rail only
      nextDueDate: now,
      buyerRoundId: seed.buyerRoundId,
    },
    select: { id: true },
  });
  const task = await prisma.chaseTask.create({
    data: {
      transactionId,
      reminderLogId: log.id,
      dueDate: now,
      status: "pending",
      priority: "normal",
      chaseCount: seed.nudgeCount,
      buyerRoundId: seed.buyerRoundId,
      assignedToId: seed.assignedUserId,
    },
    select: { id: true },
  });
  return task.id;
}
