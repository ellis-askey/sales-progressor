"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction } from "@/app/actions/tasks";
import { ChaseButton } from "@/components/chase/ChaseButton";
import { CheckCircle } from "@phosphor-icons/react";
import type { getAgentReminderLogs } from "@/lib/services/reminders";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];

const SNOOZE_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
  { label: "7 days",   hours: 168 },
  { label: "14 days",  hours: 336 },
];

function stripChase(name: string): string {
  return name.replace(/^Chase:\s*/i, "");
}

function SnoozeDropdown({ taskId, onSnooze, disabled }: {
  taskId: string;
  onSnooze: (taskId: string, hours: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        className="px-3 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/40 transition-colors disabled:opacity-40"
      >
        Snooze
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 glass-card-strong min-w-[130px]">
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              onClick={() => { onSnooze(taskId, opt.hours); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-slate-900/70 hover:bg-white/40 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentRemindersList({ logs }: { logs: AgentReminderLog[] }) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "snoozed">("active");

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activeLogs = logs.filter((l) => {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    const hasPendingTask = l.chaseTasks.length > 0;
    return due <= today || hasPendingTask;
  });

  const snoozedLogs = logs.filter(
    (l) => l.snoozedUntil && new Date(l.snoozedUntil) > now
  );

  function handleTaskAction(taskId: string, action: "complete" | "snooze", snoozeHours?: number) {
    setLoading(taskId);
    startTransition(async () => {
      try {
        if (action === "complete") await completeTaskAction(taskId, "/agent/work-queue");
        else if (action === "snooze" && snoozeHours) await snoozeTaskAction(taskId, snoozeHours, "/agent/work-queue");
      } finally {
        setLoading(null);
      }
    });
  }

  function handleWakeup(logId: string) {
    setLoading(logId);
    startTransition(async () => {
      try {
        await wakeupReminderAction(logId, "/agent/work-queue");
      } finally {
        setLoading(null);
      }
    });
  }

  const tabs = [
    { key: "active" as const,  label: "Active",  count: activeLogs.length },
    { key: "snoozed" as const, label: "Snoozed", count: snoozedLogs.length },
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
      <div className="flex items-center gap-1 mb-4 glass-subtle p-1 w-fit">
        {tabs.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)}
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
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active ─────────────────────────────────────────────────────── */}
      {tab === "active" && (
        activeLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No active reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              ...activeLogs.filter((l) => l.chaseTasks.some((t) => t.priority === "escalated")),
              ...activeLogs.filter((l) => !l.chaseTasks.some((t) => t.priority === "escalated")),
            ].map((log) => {
              const dueDate = new Date(log.nextDueDate); dueDate.setHours(0, 0, 0, 0);
              const isOverdue = dueDate < today;
              const isDueToday = dueDate.getTime() === today.getTime();
              const openTask = log.chaseTasks[0] ?? null;
              const isEscalated = openTask?.priority === "escalated";

              let borderColor = "";
              let headerBg = "bg-white/20 text-slate-900/50";
              let headerLabel = `Due ${formatDate(log.nextDueDate)}`;

              if (isEscalated) {
                borderColor = "border-red-300"; headerBg = "bg-red-50/60 text-red-700";
                headerLabel = `Escalated · ${openTask!.chaseCount} chases sent`;
              } else if (isOverdue) {
                borderColor = "border-orange-200"; headerBg = "bg-orange-50/60 text-orange-600";
                headerLabel = `Overdue · ${openTask ? `follow-up ${openTask.chaseCount + 1}` : "pending"}`;
              } else if (isDueToday) {
                borderColor = "border-amber-200"; headerBg = "bg-amber-50/60 text-amber-600";
                headerLabel = "Due today";
              }

              return (
                <div key={log.id} className={`glass-card ${borderColor ? `border ${borderColor}` : ""}`} style={{ clipPath: "inset(0 round 20px)" }}>
                  <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between ${headerBg}`}>
                    <span>{headerLabel}</span>
                    {openTask && (
                      <span className="text-xs opacity-70">
                        repeats every {log.reminderRule.repeatEveryDays}d · escalates after {log.reminderRule.escalateAfterChases}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-3">
                    <Link
                      href={`/agent/transactions/${log.transaction.id}`}
                      className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors mb-1 block"
                    >
                      {log.transaction.propertyAddress} →
                    </Link>
                    <p className={`text-sm font-medium ${isEscalated ? "text-red-700" : "text-slate-900/90"}`}>
                      {stripChase(log.reminderRule.name)}
                    </p>
                    {log.reminderRule.targetMilestoneCode && (
                      <p className="text-xs text-slate-900/40 mt-0.5 font-mono">{log.reminderRule.targetMilestoneCode}</p>
                    )}
                    {openTask && (
                      <div className="mt-3 flex items-center gap-2">
                        <ChaseButton
                          chaseTaskId={openTask.id}
                          transactionId={log.transaction.id}
                          propertyAddress={log.transaction.propertyAddress}
                          milestoneName={stripChase(log.reminderRule.name)}
                          chaseCount={openTask.chaseCount}
                          contacts={log.transaction.contacts}
                          onSent={() => handleTaskAction(openTask.id, "complete")}
                        />
                        <button
                          onClick={() => handleTaskAction(openTask.id, "complete")}
                          disabled={loading === openTask.id || isPending}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            isEscalated ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                          }`}
                        >
                          {loading === openTask.id ? "…" : "Mark done"}
                        </button>
                        <SnoozeDropdown
                          taskId={openTask.id}
                          onSnooze={(id, hours) => handleTaskAction(id, "snooze", hours)}
                          disabled={loading === openTask.id || isPending}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Snoozed ────────────────────────────────────────────────────── */}
      {tab === "snoozed" && (
        snoozedLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No snoozed reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snoozedLogs.map((log) => (
              <div key={log.id} className="glass-card border border-purple-200/60" style={{ clipPath: "inset(0 round 20px)" }}>
                <div className="px-4 py-1.5 text-xs font-medium bg-purple-50/60 text-purple-600 flex items-center justify-between">
                  <span>Snoozed until {formatDate(log.snoozedUntil!)}</span>
                  <button
                    onClick={() => handleWakeup(log.id)}
                    disabled={loading === log.id || isPending}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-40"
                  >
                    {loading === log.id ? "…" : "Wake up →"}
                  </button>
                </div>
                <div className="px-5 py-3">
                  <Link
                    href={`/agent/transactions/${log.transaction.id}`}
                    className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors mb-1 block"
                  >
                    {log.transaction.propertyAddress} →
                  </Link>
                  <p className="text-sm font-medium text-slate-900/80">{stripChase(log.reminderRule.name)}</p>
                  {log.reminderRule.targetMilestoneCode && (
                    <p className="text-xs text-slate-900/40 mt-0.5 font-mono">{log.reminderRule.targetMilestoneCode}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
