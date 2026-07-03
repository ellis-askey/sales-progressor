"use client";

// Overview restyle 2026-07-03 — client wrapper that composes NextActionCard
// with real reminder + milestone data + wired action buttons.
//
// Behaviour:
//   1. If there's an active (non-snoozed) reminder → show reminder-driven
//      card:
//        - Title    = reminderRule.name
//        - Body     = "Waiting on {nextMilestoneName}" (or a short fallback)
//        - Due      = relative to nextDueDate
//        - Mark complete → completeTaskAction(topTaskId, pathname)
//        - View     → tab switch to Reminders tab (existing pattern)
//        - Calendar → tab switch to Reminders tab (until we have a snooze
//                     picker; every action still lands on a real surface)
//   2. If no active reminder but there IS a next milestone → milestone-
//      driven card. Same shape, primary button becomes "View steps" (tab
//      switch to the Steps tab).
//   3. Otherwise → return null. The card only renders when there's
//      something to act on.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NextActionCard } from "./NextActionCard";
import { useTabContext } from "./TabContext";
import { completeTaskAction } from "@/app/actions/tasks";
import { daysUntil } from "@/lib/utils";

export type NextActionInput = {
  transactionId: string;
  pathname: string;
  reminder: {
    ruleName: string;
    topTaskId: string | null;   // null if no pending chase task on this log
    nextDueDate: Date | string;
  } | null;
  fallbackMilestone: {
    name: string;
    code: string;
  } | null;
};

function relativeDueLabel(due: Date | string): { label: string; tone: "coral" | "warn" | "muted" } {
  const days = daysUntil(due);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "warn" };
  if (days === 0) return { label: "Due today", tone: "coral" };
  if (days === 1) return { label: "Due tomorrow", tone: "coral" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "coral" };
  return { label: `Due ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, tone: "muted" };
}

export function NextActionCardConsumer({ transactionId, pathname, reminder, fallbackMilestone }: NextActionInput) {
  const { setActiveTab } = useTabContext();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Case 1 — reminder-driven
  if (reminder) {
    const due = relativeDueLabel(reminder.nextDueDate);
    const body = fallbackMilestone
      ? `Waiting on: ${fallbackMilestone.name.replace(/\.$/, "")}.`
      : "Follow up when you're ready.";

    const onMarkComplete = reminder.topTaskId
      ? () => {
          const taskId = reminder.topTaskId!;
          setError(null);
          startTransition(async () => {
            const result = await completeTaskAction(taskId, pathname);
            if ("blocked" in result && result.blocked) {
              const names = result.missing.map((m) => m.name.replace(/\.$/, "")).join(", ");
              setError(`Confirm ${names} first.`);
            } else {
              router.refresh();
            }
          });
        }
      : undefined;

    return (
      <div>
        <NextActionCard
          title={reminder.ruleName}
          description={body}
          dueLabel={pending ? "Marking..." : due.label}
          dueTone={due.tone}
          primaryLabel="Mark complete"
          onPrimary={onMarkComplete}
          secondaryLabel="View reminders"
          onSecondary={() => setActiveTab("reminders")}
          onCalendar={() => setActiveTab("reminders")}
        />
        {error && (
          <p style={{
            margin: "8px 4px 0",
            fontSize: 12,
            color: "var(--agent-warning)",
            lineHeight: 1.4,
          }}>{error}</p>
        )}
      </div>
    );
  }

  // Case 2 — milestone-driven (no active reminder)
  if (fallbackMilestone) {
    return (
      <NextActionCard
        title={fallbackMilestone.name}
        description="Next step waiting to be confirmed."
        dueLabel="No reminder yet"
        dueTone="muted"
        primaryLabel="View steps"
        onPrimary={() => setActiveTab("milestones")}
      />
    );
  }

  // Case 3 — nothing to surface
  // Suppress the ESLint warning about the ignored transactionId param —
  // it's part of the API for parity with server-action consumers even
  // when this branch doesn't use it.
  void transactionId;
  return null;
}
