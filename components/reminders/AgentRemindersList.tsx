"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction } from "@/app/actions/tasks";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import type { getAgentReminderLogs } from "@/lib/services/reminders";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];

type Tab = "active" | "snoozed";

export function AgentRemindersList({ logs }: { logs: AgentReminderLog[] }) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activeLogs = logs.filter((l) => {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due <= today || l.chaseTasks.length > 0;
  });

  const snoozedLogs = logs.filter(
    (l) => l.snoozedUntil && new Date(l.snoozedUntil) > now
  );

  // Sort active: escalated first → overdue by days desc → due today → rest
  const sortedActive = [...activeLogs].sort((a, b) => {
    const aEsc = a.chaseTasks.some((t) => t.priority === "escalated") ? 0 : 1;
    const bEsc = b.chaseTasks.some((t) => t.priority === "escalated") ? 0 : 1;
    if (aEsc !== bEsc) return aEsc - bEsc;
    return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  const escalatedCount = activeLogs.filter((l) =>
    l.chaseTasks.some((t) => t.priority === "escalated")
  ).length;

  const overdueCount = activeLogs.filter((l) => {
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  function act(id: string, fn: () => Promise<unknown>) {
    setLoading(id);
    startTransition(async () => {
      try { await fn(); } finally { setLoading(null); }
    });
  }

  function handleComplete(taskId: string) {
    act(taskId, () => completeTaskAction(taskId, "/agent/work-queue"));
  }

  function handleSnooze(taskId: string, hours: number) {
    act(taskId, () => snoozeTaskAction(taskId, hours, "/agent/work-queue"));
  }

  function handleEscalate(taskId: string) {
    act(taskId, () => escalateTaskAction(taskId, "/agent/work-queue"));
  }

  function handleWakeup(logId: string) {
    act(logId, () => wakeupReminderAction(logId, "/agent/work-queue"));
  }

  const tabs = [
    { key: "active" as Tab,  label: "Active",  count: activeLogs.length },
    { key: "snoozed" as Tab, label: "Snoozed", count: snoozedLogs.length },
  ];

  if (logs.length === 0) {
    return (
      <div className="glass-card" style={{ padding: "40px 32px", textAlign: "center" }}>
        <CheckCircle weight="fill" style={{ width: 32, height: 32, color: "var(--agent-success)", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>All chase tasks clear</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>No milestone reminders due right now.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary pills */}
      {activeLogs.length > 0 && (escalatedCount > 0 || overdueCount > 0) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {escalatedCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
              {escalatedCount} escalated
            </span>
          )}
          {overdueCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
              {overdueCount} overdue
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 glass-subtle p-1 w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === key ? "bg-white/60 text-slate-900/90 shadow-sm" : "text-slate-900/50 hover:text-slate-900/70"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                tab === key
                  ? key === "snoozed" ? "bg-purple-50/80 text-purple-600" : "bg-blue-50/80 text-blue-600"
                  : "bg-white/30 text-slate-900/50"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active */}
      {tab === "active" && (
        sortedActive.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No active reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedActive.map((log) => (
              <ReminderCard
                key={log.id}
                log={log}
                transactionId={log.transaction.id}
                contacts={log.transaction.contacts}
                propertyAddress={log.transaction.propertyAddress}
                showAddressLink
                isLoading={loading}
                isPending={isPending}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onEscalate={handleEscalate}
              />
            ))}
          </div>
        )
      )}

      {/* Snoozed */}
      {tab === "snoozed" && (
        snoozedLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No snoozed reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snoozedLogs.map((log) => (
              <ReminderCard
                key={log.id}
                log={log}
                transactionId={log.transaction.id}
                contacts={log.transaction.contacts}
                propertyAddress={log.transaction.propertyAddress}
                showAddressLink
                mode="snoozed"
                isLoading={loading}
                isPending={isPending}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onEscalate={handleEscalate}
                onWakeup={handleWakeup}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
