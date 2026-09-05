"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeChaseTaskWhere, scopeReminderLogWhere } from "@/lib/security/access-scope";
import { completeChaseTask, advanceChaseTask, advanceChasesForMilestones, snoozeReminderLog, wakeUpReminderLog, runReminderEngine, evaluateTransactionReminders, setUkChaseTime, type SnoozeWake, type SnoozeResult } from "@/lib/services/reminders";
import { completeMilestone, maybeAutoCompleteTransaction } from "@/lib/services/milestones";
import { createCommunicationRecord } from "@/lib/services/comms";
import { prisma } from "@/lib/prisma";
import { touchLastActivity } from "@/lib/services/activity";
import { formatDate } from "@/lib/utils";
import { pushChaseEscalation } from "@/lib/agent/push-events";
import type { AccessScope } from "@/lib/security/access-scope";

// Options a snooze carries from the menu: how long (a quick gap or a picked
// date) and an optional agent reason.
export interface SnoozeOptions {
  hours?: number;
  untilISO?: string;
  reason?: string | null;
}

// Post an internal note on the file's Activity tab recording the snooze, so the
// rest of the team can see it (and why, if a reason was given). Best-effort:
// a note failure never blocks the snooze itself.
async function logSnoozeNote(input: {
  transactionId: string;
  milestoneNames: string[];
  wakeDate: Date;
  reason: string | null;
  createdById: string;
  createdByRole: string;
  scope: AccessScope;
}) {
  const when = formatDate(input.wakeDate);
  const names = input.milestoneNames;
  const head = names.length === 1
    ? `Snoozed "${names[0]}" until ${when}.`
    : `Snoozed ${names.length} reminders until ${when}: ${names.join(", ")}.`;
  const content = input.reason ? `${head} ${input.reason}` : head;
  await createCommunicationRecord({
    transactionId: input.transactionId,
    type: "internal_note",
    contactIds: [],
    content,
    createdById: input.createdById,
    createdByRole: input.createdByRole,
    scope: input.scope,
  }).catch(() => {});
}

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
        // Auto-flip tx.status to "completed" once both completion milestones
        // land. Mirrors confirmMilestoneAction line 232 + the reconciliation
        // action fix from 2026-08-08. Without this, ticking Done on a
        // completion-milestone reminder from the Reminders queue leaves the
        // file in Active until the 03:45 UTC cron catches it.
        if (targetMilestoneCode === "VM20" || targetMilestoneCode === "PM27") {
          await maybeAutoCompleteTransaction(transactionId, {
            actorUserId: session.user.id,
          });
        }
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

export async function snoozeTaskAction(taskId: string, opts: SnoozeOptions, pathname: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const reason = opts.reason?.trim() || null;
  const wake: SnoozeWake = opts.untilISO ? { untilISO: opts.untilISO } : { hours: opts.hours };
  const res = await snoozeReminderLog(taskId, wake, reason, scope);
  await logSnoozeNote({
    transactionId: res.transactionId,
    milestoneNames: [res.milestoneName],
    wakeDate: res.wakeDate,
    reason,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope,
  });
  revalidatePath(pathname, "page");
}

// Snooze several reminders on one file at once (the "Snooze all" control), with a
// single shared reason and one combined Activity note rather than N near-identical
// ones. All ids are expected to belong to the same file.
export async function snoozeManyAction(taskIds: string[], opts: SnoozeOptions, pathname: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const reason = opts.reason?.trim() || null;
  const wake: SnoozeWake = opts.untilISO ? { untilISO: opts.untilISO } : { hours: opts.hours };

  const results: SnoozeResult[] = [];
  for (const id of taskIds) {
    try {
      results.push(await snoozeReminderLog(id, wake, reason, scope));
    } catch {
      // A single bad id shouldn't abort the rest of the batch.
    }
  }
  if (results.length > 0) {
    await logSnoozeNote({
      transactionId: results[0].transactionId,
      milestoneNames: results.map((r) => r.milestoneName),
      wakeDate: results[0].wakeDate,
      reason,
      createdById: session.user.id,
      createdByRole: session.user.role,
      scope,
    });
  }
  revalidatePath(pathname, "page");
}

export async function wakeupReminderAction(logId: string, pathname: string) {
  const session = await requireSession();
  await wakeUpReminderLog(logId, getAccessScope(session));
  revalidatePath(pathname, "page");
}

// Agent chooses to chase this reminder BEFORE its scheduled start date. Creates
// the ChaseTask that would normally be created by the cron's self-heal, and
// wakes the reminder log so its nextDueDate is now — the drawer opens against
// the returned task id so the agent can send immediately.
// Idempotent: if a pending task already exists for the log, returns its id
// without creating a duplicate.
export async function chaseNowFromLogAction(
  logId: string,
  pathname: string,
): Promise<{ taskId: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.reminderLog.findFirst({
      where: scopeReminderLogWhere(scope, logId),
      select: {
        id: true,
        transactionId: true,
        status: true,
        chaseTasks: {
          where: { status: "pending" },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!log) throw new Error("Reminder log not found");
    if (log.status !== "active") throw new Error("Reminder log is not active");

    if (log.chaseTasks.length > 0) {
      return { taskId: log.chaseTasks[0].id, transactionId: log.transactionId };
    }

    const task = await tx.chaseTask.create({
      data: {
        transactionId: log.transactionId,
        reminderLogId: log.id,
        dueDate: new Date(),
        status: "pending",
        priority: "normal",
        chaseCount: 0,
      },
      select: { id: true },
    });

    await tx.reminderLog.update({
      where: { id: log.id },
      data: { nextDueDate: setUkChaseTime(new Date()), snoozedUntil: null, statusReason: null },
    });

    return { taskId: task.id, transactionId: log.transactionId };
  });

  touchLastActivity(result.transactionId).catch(() => {});
  revalidatePath(pathname, "page");
  return { taskId: result.taskId };
}

export async function advanceChaseTaskAction(taskId: string, pathname: string) {
  const session = await requireSession();
  await advanceChaseTask(taskId, getAccessScope(session));
  revalidatePath(pathname, "page");
}

// One tap after the WhatsApp check-in copy: stamps a manual chase on every
// copied step that has an open chase task. Returns how many actually got
// stamped so the button can report honestly.
export async function markStepsChasedAction(
  transactionId: string,
  milestoneCodes: string[],
  pathname: string,
): Promise<{ marked: number }> {
  const session = await requireSession();
  const marked = await advanceChasesForMilestones(
    transactionId,
    milestoneCodes,
    getAccessScope(session),
  );
  if (marked > 0) touchLastActivity(transactionId).catch(() => {});
  revalidatePath(pathname, "page");
  return { marked };
}

export async function recordManualChaseAction(taskId: string, pathname: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: { id: true, chaseCount: true, manualChaseCount: true, transactionId: true },
  });
  if (!task) throw new Error("Task not found");
  await prisma.chaseTask.update({
    where: { id: taskId },
    data: {
      chaseCount: task.chaseCount + 1,
      // Manual "I chased them" — a human chase, so it counts toward escalation.
      manualChaseCount: task.manualChaseCount + 1,
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

export async function escalateTaskAction(taskId: string, pathname: string, reason?: string) {
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
  // 2026-07-13 (Chunk 6d): store the reason + who + when on the ChaseTask
  // so the escalated chip can surface it on hover. reason is optional -
  // callers that don't collect one (bulk actions, keyboard-shortcut path)
  // still work; reason stays null.
  const trimmedReason = reason?.trim() || null;
  await prisma.chaseTask.update({
    where: { id: taskId },
    data: {
      priority: "escalated",
      escalationReason: trimmedReason,
      escalatedAt: new Date(),
      escalatedById: session.user.id,
    },
  });

  // Fire push + activity-feed entry only on the transition
  // non-escalated → escalated. Skipping when already escalated avoids
  // double-notify if the user clicks Escalate twice on the same row.
  if (!wasEscalated) {
    const milestoneLabel = task.reminderLog?.reminderRule?.name?.replace(/^Chase:\s*/i, "") ?? null;
    pushChaseEscalation(task.transactionId, milestoneLabel).catch(() => {});

    // 2026-07-13 (Chunk 6e): write to the activity feed so the file owner
    // can see the escalation happened (with who + why) even if the chip
    // gets chased-through and cleared. Fire-and-forget - a feed failure
    // shouldn't roll back the escalation write above.
    const label = milestoneLabel ?? "chase";
    const suffix = trimmedReason ? ` — reason: ${trimmedReason}` : "";
    prisma.outboundMessage.create({
      data: {
        transactionId: task.transactionId,
        type: "internal_note",
        contactIds: [],
        content: `${session.user.name ?? "Someone"} escalated "${label}"${suffix}`,
        createdById: session.user.id,
      },
    }).catch(() => {});
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
