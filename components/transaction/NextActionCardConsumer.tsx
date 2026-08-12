"use client";

// Merged Next-action + Reminders card (2026-08-12). The hero is the single
// most-urgent thing (top reminder, or a milestone fallback); the remaining
// active reminders list underneath as "Up next" — so the #1 reminder is shown
// ONCE, not duplicated across two cards. When there's no hero but reminders
// exist (e.g. all snoozed) it falls back to a plain reminders card.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NextActionCard } from "./NextActionCard";
import { useTabContext } from "./TabContext";
import { completeTaskAction } from "@/app/actions/tasks";
import { daysUntil, formatDate } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";

type MiniReminder = { id: string; ruleName: string; nextDueDate: Date | string; snoozedUntil?: Date | string | null };

export type NextActionInput = {
  transactionId: string;
  pathname: string;
  reminder: {
    ruleName: string;
    topTaskId: string | null;
    nextDueDate: Date | string;
  } | null;
  fallbackMilestone: { name: string; code: string } | null;
  otherReminders: MiniReminder[];
  totalActive: number;
};

function relativeDueLabel(due: Date | string): { label: string; tone: "coral" | "warn" | "muted" } {
  const days = daysUntil(due);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "warn" };
  if (days === 0) return { label: "Due today", tone: "coral" };
  if (days === 1) return { label: "Due tomorrow", tone: "coral" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "coral" };
  return { label: `Due ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, tone: "muted" };
}

function ReminderRow({ r }: { r: MiniReminder }) {
  const isSnoozed = r.snoozedUntil && new Date(r.snoozedUntil) > new Date();
  if (isSnoozed) {
    return (
      <div className="agent-hover-row" style={{ padding: "7px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "rgba(15,23,42,0.18)" }} />
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ruleName}</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", flexShrink: 0 }}>Snoozed until {formatDate(r.snoozedUntil!)}</span>
      </div>
    );
  }
  const days = daysUntil(r.nextDueDate);
  const isOverdue = days < 0;
  const isToday = days === 0;
  const dotColor = isOverdue ? "#ef4444" : isToday ? "var(--agent-coral)" : "rgba(15,23,42,0.18)";
  const text = isOverdue ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue` : isToday ? "Due today" : `From ${formatDate(r.nextDueDate)}`;
  return (
    <div style={{ padding: "7px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: dotColor }} />
        <span style={{ fontSize: 12, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ruleName}</span>
      </div>
      <span style={{ fontSize: 10, color: isOverdue ? "#ef4444" : "var(--agent-text-muted)", flexShrink: 0, fontWeight: isOverdue ? 600 : 400 }}>{text}</span>
    </div>
  );
}

function UpNext({ reminders, totalActive, onViewAll }: { reminders: MiniReminder[]; totalActive: number; onViewAll: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <span className="agent-eyebrow" style={{ margin: 0 }}>Up next</span>
        <button onClick={onViewAll} className="agent-link" style={{ fontSize: 11 }}>
          View all{totalActive > 0 ? ` (${totalActive})` : ""} →
        </button>
      </div>
      {reminders.map((r) => <ReminderRow key={r.id} r={r} />)}
    </div>
  );
}

export function NextActionCardConsumer({ transactionId, pathname, reminder, fallbackMilestone, otherReminders, totalActive }: NextActionInput) {
  const { setActiveTab } = useTabContext();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const goReminders = () => setActiveTab("reminders");
  const list = otherReminders.length > 0
    ? <UpNext reminders={otherReminders} totalActive={totalActive} onViewAll={goReminders} />
    : undefined;

  // Case 1 — reminder-driven hero
  if (reminder) {
    const due = relativeDueLabel(reminder.nextDueDate);
    const body = fallbackMilestone ? `Waiting on: ${fallbackMilestone.name.replace(/\.$/, "")}.` : "Follow up when you're ready.";
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
          onSecondary={goReminders}
          onCalendar={goReminders}
          belowActions={list}
        />
        {error && <p style={{ margin: "8px 4px 0", fontSize: 12, color: "var(--agent-warning)", lineHeight: 1.4 }}>{error}</p>}
      </div>
    );
  }

  // Case 2 — milestone-driven hero (no active reminder)
  if (fallbackMilestone) {
    return (
      <NextActionCard
        title={fallbackMilestone.name}
        description="Next step waiting to be confirmed."
        dueLabel="No reminder yet"
        dueTone="muted"
        primaryLabel="View steps"
        onPrimary={() => setActiveTab("milestones")}
        belowActions={list}
      />
    );
  }

  // Case 3 — no hero, but reminders exist (e.g. all snoozed): plain list card.
  void transactionId;
  if (otherReminders.length > 0) {
    return (
      <GlassCard glassId="overview-reminders" label="Overview · Reminders" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 12 }}>
        <div className="agent-card-hdr">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 className="agent-card-title">Reminders</h3>
            {totalActive > 0 && <span className="agent-badge">{totalActive}</span>}
          </div>
          <button onClick={goReminders} className="agent-link" style={{ fontSize: 11 }}>View all →</button>
        </div>
        <div style={{ padding: "6px 16px 12px" }}>
          {otherReminders.map((r) => <ReminderRow key={r.id} r={r} />)}
        </div>
      </GlassCard>
    );
  }

  return null;
}
