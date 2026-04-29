"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, recordManualChaseAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ReminderCard, type Contact } from "@/components/reminders/ReminderCard";

type ChaseTask = {
  id: string;
  status: string;
  priority: string;
  chaseCount: number;
  dueDate: Date;
  communications: { createdAt: Date; method: string | null }[];
};

type ReminderLog = {
  id: string;
  status: string;
  nextDueDate: Date;
  snoozedUntil: Date | null;
  statusReason: string | null;
  reminderRule: {
    name: string;
    description?: string | null;
    targetMilestoneCode: string | null;
    graceDays: number;
    repeatEveryDays: number;
    escalateAfterChases: number;
  };
  chaseTasks: ChaseTask[];
};

type Props = {
  transactionId: string;
  reminderLogs: ReminderLog[];
  completedMilestoneCodes?: Set<string>;
  contacts?: Contact[];
  propertyAddress?: string;
};

type Tab = "active" | "upcoming" | "snoozed" | "completed";

function stripChase(name: string) {
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

export function RemindersSection({
  transactionId,
  reminderLogs,
  completedMilestoneCodes,
  contacts = [],
  propertyAddress = "",
}: Props) {
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
    return due <= today || l.chaseTasks.some((t) => t.status === "pending");
  });

  const upcomingLogs = reminderLogs.filter((l) => {
    if (l.status !== "active") return false;
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    if (due <= today || l.chaseTasks.some((t) => t.status === "pending")) return false;
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

  // Sort active: escalated first → overdue oldest → rest
  const sortedActive = [...activeLogs].sort((a, b) => {
    const aEsc = a.chaseTasks.some((t) => t.priority === "escalated") ? 0 : 1;
    const bEsc = b.chaseTasks.some((t) => t.priority === "escalated") ? 0 : 1;
    if (aEsc !== bEsc) return aEsc - bEsc;
    return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  function act(id: string, fn: () => Promise<unknown>) {
    setLoading(id);
    startTransition(async () => {
      try { await fn(); } finally { setLoading(null); }
    });
  }

  function handleComplete(taskId: string) {
    act(taskId, () => completeTaskAction(taskId, pathname));
  }
  function handleSnooze(taskId: string, hours: number) {
    act(taskId, () => snoozeTaskAction(taskId, hours, pathname));
  }
  function handleEscalate(taskId: string) {
    act(taskId, () => escalateTaskAction(taskId, pathname));
  }
  function handleWakeup(logId: string) {
    act(logId, () => wakeupReminderAction(logId, pathname));
  }
  function handleManualChase(taskId: string) {
    act(taskId, () => recordManualChaseAction(taskId, pathname));
  }
  function handleChased(taskId: string) {
    act(taskId, () => advanceChaseTaskAction(taskId, pathname));
  }

  async function runEngine() {
    setLoading("engine");
    startTransition(async () => {
      try { await runReminderEngineAction(pathname); } finally { setLoading(null); }
    });
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
        <button
          onClick={runEngine}
          disabled={loading === "engine" || isPending}
          className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
        >
          {loading === "engine" ? "Running…" : "↻ Run engine"}
        </button>
      </div>

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

      {/* ── Active ──────────────────────────────────────────────────────── */}
      {tab === "active" && (
        sortedActive.length === 0 ? (
          <div className="glass-card px-5 py-8 text-center">
            <p className="text-sm text-slate-900/40">No active reminders</p>
            <p className="text-xs text-slate-900/30 mt-1">Tasks appear here once their grace period has passed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedActive.map((log) => (
              <ReminderCard
                key={log.id}
                log={log}
                transactionId={transactionId}
                contacts={contacts}
                propertyAddress={propertyAddress}
                isLoading={loading}
                isPending={isPending}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onEscalate={handleEscalate}
                onManualChase={handleManualChase}
                onChased={handleChased}
              />
            ))}
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
              <ReminderCard
                key={log.id}
                log={log}
                transactionId={transactionId}
                contacts={contacts}
                propertyAddress={propertyAddress}
                mode="snoozed"
                isLoading={loading}
                isPending={isPending}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onEscalate={handleEscalate}
                onWakeup={handleWakeup}
                onManualChase={handleManualChase}
                onChased={handleChased}
              />
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
                <p className="text-xs text-slate-900/40 mt-0.5 capitalize">
                  {log.status}{log.statusReason ? ` · ${log.statusReason}` : ""}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}
