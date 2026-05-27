// One source of truth for "what bucket is this reminder log in".
//
// Every count + every visible bucket reads from here. The rule:
//   active + snoozedUntil > now              → snoozed (hidden)
//   active + escalated pending task          → escalated  (red, counts)
//   active + chaseCount >= 1                 → upcoming   (muted, doesn't count)
//   active + nextDueDate < today             → overdue    (red,   counts)
//   active + nextDueDate = today             → due_today  (amber, counts)
//   active + nextDueDate > today             → upcoming   (muted, doesn't count)
//   not active                               → inactive   (hidden)
//
// The chased-stays-upcoming rule is the load-bearing piece — once an agent
// has chased a row it lives in Coming up regardless of the next-due-date,
// because the agent has acted. Only the server's escalation flag (after the
// chase-count cap) brings it back into the actionable count.

import { toUKDateStr } from "@/lib/utils";

export type LogForClassify = {
  nextDueDate: Date;
  snoozedUntil: Date | null;
  status: string;
  chaseTasks: Array<{ status: string; priority: string; chaseCount: number }>;
};

export type ReminderBucket =
  | "overdue"
  | "due_today"
  | "upcoming"
  | "escalated"
  | "snoozed"
  | "inactive";

export function classifyReminder(log: LogForClassify, now: Date = new Date()): ReminderBucket {
  if (log.status !== "active") return "inactive";
  if (log.snoozedUntil && new Date(log.snoozedUntil).getTime() > now.getTime()) return "snoozed";

  const openTask = log.chaseTasks.find((t) => t.status === "pending");
  if (openTask?.priority === "escalated") return "escalated";
  if ((openTask?.chaseCount ?? 0) >= 1) return "upcoming";

  const todayStr = toUKDateStr(now);
  const dueStr = toUKDateStr(log.nextDueDate);
  if (dueStr < todayStr) return "overdue";
  if (dueStr === todayStr) return "due_today";
  return "upcoming";
}

export function isActionable(bucket: ReminderBucket): boolean {
  return bucket === "overdue" || bucket === "due_today" || bucket === "escalated";
}

export function countActionable(logs: LogForClassify[], now: Date = new Date()): number {
  return logs.filter((l) => isActionable(classifyReminder(l, now))).length;
}

export function countOverdue(logs: LogForClassify[], now: Date = new Date()): number {
  return logs.filter((l) => classifyReminder(l, now) === "overdue").length;
}
