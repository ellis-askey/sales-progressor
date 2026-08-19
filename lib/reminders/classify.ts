// One source of truth for "what bucket is this reminder log in".
//
// Every count + every visible bucket reads from here. The rule:
//   active + snoozedUntil > now              → snoozed (hidden)
//   active + escalated pending task          → escalated  (red, counts)
//   active + chased + nextDueDate < today    → overdue    (red, counts)
//   active + chased + nextDueDate = today    → due_today  (amber, counts)
//   active + chased + nextDueDate > today    → upcoming   (muted, doesn't count)
//   active + not chased + nextDueDate < today → overdue   (red, counts)
//   active + not chased + nextDueDate = today → due_today (amber, counts)
//   active + not chased + nextDueDate > today → upcoming  (muted, doesn't count)
//   not active                               → inactive   (hidden)
//
// Chased-stays-upcoming originally short-circuited every chased row into
// `upcoming`, but that left rows stuck forever when an agent chased once
// then went silent past the next due date (see 2026-06 stuck-reminder
// audit). Now both branches are date-aware: chasing once doesn't hide a
// row from the actionable view once its next chase date has passed. The
// only thing chasing does is advance `nextDueDate` forward; the bucket
// still follows the calendar.

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

  // Date-aware classification applies to both first-chase (chaseCount=0)
  // AND already-chased (chaseCount>=1) rows. A chased row whose next
  // chase date has passed re-enters the actionable bucket; clicking
  // "Chased" again advances `nextDueDate` forward and the row returns
  // to "upcoming". See header comment for the rationale.
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

// Badge text for "who chased this, and how often". `auto` = automated
// client-chase digest sends; `manual` = chases a person made (the ↻ Chased
// button, a drawer send, or the manual "I chased them" record). Kept
// separate so an autopilot-only file never reads as though the agent chased
// it. Returns null when nothing has been chased yet.
export function chaseBadgeLabel(auto: number, manual: number): string | null {
  if (auto <= 0 && manual <= 0) return null;
  if (auto > 0 && manual > 0) return `Auto ${auto}× · you ${manual}×`;
  if (auto > 0) return `Auto-chased ${auto}×`;
  return `Chased ${manual}×`;
}
