"use client";
// components/reminders/RemindersSection.tsx

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction } from "@/app/actions/tasks";
import { ChaseButton } from "@/components/chase/ChaseButton";

type ChaseTask = {
  id: string;
  status: string;
  priority: string;
  chaseCount: number;
  dueDate: Date;
};

type ReminderLog = {
  id: string;
  status: string;
  nextDueDate: Date;
  snoozedUntil: Date | null;
  statusReason: string | null;
  reminderRule: {
    name: string;
    targetMilestoneCode: string | null;
    graceDays: number;
    repeatEveryDays: number;
    escalateAfterChases: number;
  };
  chaseTasks: ChaseTask[];
};

type Contact = {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
};

type Props = {
  transactionId: string;
  reminderLogs: ReminderLog[];
  completedMilestoneCodes?: Set<string>;
  contacts?: Contact[];
  propertyAddress?: string;
};

type Tab = "active" | "upcoming" | "snoozed" | "completed";

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

function isSunday(d: Date) { return d.getDay() === 0; }

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isSunday(result)) added++;
  }
  return result;
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

export function RemindersSection({ transactionId, reminderLogs, completedMilestoneCodes, contacts, propertyAddress }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingCutoff = addBusinessDays(today, 3);

  const activeLogs = reminderLogs.filter((l) => {
    if (l.status !== "active") return false;
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    const hasPendingTask = l.chaseTasks.some((t) => t.status === "pending");
    return due <= today || hasPendingTask;
  });

  const upcomingLogs = reminderLogs.filter((l) => {
    if (l.status !== "active") return false;
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    const hasPendingTask = l.chaseTasks.some((t) => t.status === "pending");
    if (due <= today || hasPendingTask) return false;
    // Hide if target milestone is already complete
    if (completedMilestoneCodes && l.reminderRule.targetMilestoneCode) {
      if (completedMilestoneCodes.has(l.reminderRule.targetMilestoneCode)) return false;
    }
    return due <= upcomingCutoff && !isSunday(due);
  });

  const snoozedLogs = reminderLogs.filter(
    (l) => l.status === "active" && l.snoozedUntil && new Date(l.snoozedUntil) > now
  );

  const completedLogs = reminderLogs.filter(
    (l) => l.status === "completed" || l.status === "inactive"
  );

  const escalatedCount = activeLogs.filter((l) =>
    l.chaseTasks.some((t) => t.status === "pending" && t.priority === "escalated")
  ).length;

  function handleTaskAction(taskId: string, action: "complete" | "snooze", snoozeHours?: number) {
    setLoading(taskId);
    startTransition(async () => {
      try {
        if (action === "complete") await completeTaskAction(taskId, pathname);
        else if (action === "snooze" && snoozeHours) await snoozeTaskAction(taskId, snoozeHours, pathname);
      } finally {
        setLoading(null);
      }
    });
  }

  function handleWakeup(logId: string) {
    setLoading(logId);
    startTransition(async () => {
      try {
        await wakeupReminderAction(logId, pathname);
      } finally {
        setLoading(null);
      }
    });
  }

  async function runEngine() {
    setLoading("engine");
    try {
      await fetch("/api/reminders/run", { method: "POST" });
      startTransition(() => router.refresh()); // pending SA migration (no SA for run-engine yet)
    } finally { setLoading(null); }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active",    label: "Active",    count: activeLogs.length },
    { key: "upcoming",  label: "Coming up", count: upcomingLogs.length },
    { key: "snoozed",   label: "Snoozed",   count: snoozedLogs.length },
    { key: "completed", label: "Completed", count: completedLogs.length },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">Reminders & Tasks</h2>
          {escalatedCount > 0 && (
            <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">
              {escalatedCount} escalated
            </span>
          )}
        </div>
        <button onClick={runEngine} disabled={loading === "engine" || isPending} className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors">
          {loading === "engine" ? "Running…" : "↻ Run engine"}
        </button>
      </div>

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

      {/* ── Active ──────────────────────────────────────────────────────── */}
      {tab === "active" && (
        activeLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No active reminders</p>
            <p className="text-xs text-slate-900/30 mt-1">Tasks appear here once their grace period has passed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              ...activeLogs.filter((l) => l.chaseTasks.some((t) => t.status === "pending" && t.priority === "escalated")),
              ...activeLogs.filter((l) => !l.chaseTasks.some((t) => t.status === "pending" && t.priority === "escalated")),
            ].map((log) => {
              const dueDate = new Date(log.nextDueDate); dueDate.setHours(0, 0, 0, 0);
              const isOverdue = dueDate < today;
              const isDueToday = dueDate.getTime() === today.getTime();
              const openTask = log.chaseTasks.find((t) => t.status === "pending");
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
                    {openTask && <span className="text-xs opacity-70">repeats every {log.reminderRule.repeatEveryDays}d · escalates after {log.reminderRule.escalateAfterChases}</span>}
                  </div>
                  <div className="px-5 py-3">
                    <p className={`text-sm font-medium ${isEscalated ? "text-red-700" : "text-slate-900/90"}`}>
                      {stripChase(log.reminderRule.name)}
                    </p>
                    {log.reminderRule.targetMilestoneCode && (
                      <p className="text-xs text-slate-900/40 mt-0.5 font-mono">{log.reminderRule.targetMilestoneCode}</p>
                    )}
                    {openTask && (
                      <div className="mt-3 flex items-center gap-2">
                        {contacts && propertyAddress && (
                          <ChaseButton
                            chaseTaskId={openTask.id}
                            transactionId={transactionId}
                            propertyAddress={propertyAddress}
                            milestoneName={stripChase(log.reminderRule.name)}
                            chaseCount={openTask.chaseCount}
                            contacts={contacts}
                            onSent={() => handleTaskAction(openTask.id, "complete")}
                          />
                        )}
                        <button onClick={() => handleTaskAction(openTask.id, "complete")} disabled={loading === openTask.id || isPending}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            isEscalated ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                          }`}>
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

      {/* ── Coming up ───────────────────────────────────────────────────── */}
      {tab === "upcoming" && (
        upcomingLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">Nothing due in the next 3 days</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingLogs
              .slice().sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
              .map((log) => (
                <div key={log.id} className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
                  <div className="px-4 py-1.5 text-xs font-medium bg-blue-50/60 text-blue-600 flex items-center justify-between">
                    <span>Due {formatDate(log.nextDueDate)}</span>
                    <span className="opacity-60">{log.reminderRule.graceDays}d grace</span>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900/90">{stripChase(log.reminderRule.name)}</p>
                    {log.reminderRule.targetMilestoneCode && (
                      <p className="text-xs text-slate-900/40 mt-0.5 font-mono">{log.reminderRule.targetMilestoneCode}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )
      )}

      {/* ── Snoozed ─────────────────────────────────────────────────────── */}
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
                  <button onClick={() => handleWakeup(log.id)} disabled={loading === log.id || isPending}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-40">
                    {loading === log.id ? "…" : "Wake up →"}
                  </button>
                </div>
                <div className="px-5 py-3">
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

      {/* ── Completed ───────────────────────────────────────────────────── */}
      {tab === "completed" && (
        completedLogs.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No completed reminders yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {completedLogs.map((log) => (
              <div key={log.id} className="glass-subtle rounded-xl px-4 py-2.5">
                <p className="text-xs font-medium text-slate-900/60">{stripChase(log.reminderRule.name)}</p>
                <p className="text-xs text-slate-900/40 mt-0.5 capitalize">{log.status}{log.statusReason ? ` · ${log.statusReason}` : ""}</p>
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}
