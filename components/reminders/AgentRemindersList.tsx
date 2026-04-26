"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, recordManualChaseAction } from "@/app/actions/tasks";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import type { getAgentReminderLogs } from "@/lib/services/reminders";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";

const GROUP_CONFIG: Record<UrgencyGroup, { label: string; headerCls: string; labelCls: string; badgeCls: string }> = {
  escalated: { label: "Escalated",  headerCls: "bg-red-50/70 border border-red-200",       labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700"       },
  overdue:   { label: "Overdue",    headerCls: "bg-orange-50/70 border border-orange-100", labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700" },
  due_today: { label: "Due today",  headerCls: "bg-amber-50/60 border border-amber-100",   labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700"   },
  upcoming:  { label: "Coming up",  headerCls: "bg-white/30 border border-white/50",        labelCls: "text-slate-900/60", badgeCls: "bg-white/60 text-slate-900/60" },
};

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

// targetMilestoneCode is used here only for internal urgency classification — never rendered in the UI
function classifyActive(log: AgentReminderLog, today: Date): UrgencyGroup | null {
  const openTask = log.chaseTasks[0] ?? null;
  if (openTask?.priority === "escalated") return "escalated";
  const due = new Date(log.nextDueDate); due.setHours(0, 0, 0, 0);
  const taskDue = openTask ? (() => { const d = new Date(openTask.dueDate); d.setHours(0, 0, 0, 0); return d; })() : null;
  if (due < today || (taskDue && taskDue < today)) return "overdue";
  if (due.getTime() === today.getTime()) return "due_today";
  if (due <= addBusinessDays(today, 3)) return "upcoming";
  return null;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
        active ? "bg-white/70 shadow-sm text-slate-900/90" : "bg-white/30 text-slate-900/50 hover:bg-white/50"
      }`}
    >
      {children}
    </button>
  );
}

export function AgentRemindersList({ logs }: { logs: AgentReminderLog[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // targetMilestoneCode drives the side filter — for internal classification only, never rendered
  const [sideFilter, setSideFilter] = useState<"all" | "seller" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"due" | "snoozed">("due");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Auto-run the reminder engine on mount so chase tasks exist for any due reminders
  useEffect(() => {
    runReminderEngineAction("/agent/work-queue")
      .then(() => startTransition(() => router.refresh()))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Split snoozed vs active upfront — snoozed logs never enter the urgency grouping pipeline
  const snoozedLogs = logs.filter((l) => l.snoozedUntil && new Date(l.snoozedUntil) > now);
  const nonSnoozedLogs = logs.filter((l) => !(l.snoozedUntil && new Date(l.snoozedUntil) > now));

  const q = search.toLowerCase().trim();

  function matchesFilter(l: AgentReminderLog) {
    if (q && !l.transaction.propertyAddress.toLowerCase().includes(q) && !l.reminderRule.name.toLowerCase().includes(q)) return false;
    if (sideFilter === "seller" && !l.reminderRule.targetMilestoneCode?.startsWith("VM")) return false;
    if (sideFilter === "buyer"  && !l.reminderRule.targetMilestoneCode?.startsWith("PM")) return false;
    return true;
  }

  const filteredActive = nonSnoozedLogs.filter(matchesFilter);
  const filteredSnoozed = snoozedLogs.filter(matchesFilter);

  // Group and sort active logs
  const grouped: Record<UrgencyGroup, AgentReminderLog[]> = { escalated: [], overdue: [], due_today: [], upcoming: [] };
  for (const log of filteredActive) {
    const g = classifyActive(log, today);
    if (g) grouped[g].push(log);
  }
  grouped.escalated.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  grouped.overdue.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  grouped.due_today.sort((a, b) => a.reminderRule.name.localeCompare(b.reminderRule.name));
  grouped.upcoming.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  function act(id: string, fn: () => Promise<unknown>) {
    setLoading(id);
    startTransition(async () => {
      try { await fn(); } finally { setLoading(null); }
    });
  }

  function handleComplete(taskId: string) { act(taskId, () => completeTaskAction(taskId, "/agent/work-queue")); }
  function handleSnooze(taskId: string, hours: number) { act(taskId, () => snoozeTaskAction(taskId, hours, "/agent/work-queue")); }
  function handleEscalate(taskId: string) { act(taskId, () => escalateTaskAction(taskId, "/agent/work-queue")); }
  function handleWakeup(logId: string) { act(logId, () => wakeupReminderAction(logId, "/agent/work-queue")); }
  function handleManualChase(taskId: string) { act(taskId, () => recordManualChaseAction(taskId, "/agent/work-queue")); }

  function toggleCollapse(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  if (logs.length === 0) {
    return (
      <div className="glass-card" style={{ padding: "40px 32px", textAlign: "center" }}>
        <CheckCircle weight="fill" style={{ width: 32, height: 32, color: "var(--agent-success)", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>All chase tasks clear</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>No milestone reminders due right now.</p>
      </div>
    );
  }

  const hasActiveResults = filteredActive.length > 0;

  return (
    <div className="space-y-5">
      {/* Search + filter bar */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search address or reminder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-lg glass-subtle border-0 outline-none placeholder:text-slate-900/30 text-slate-900/80"
        />
        <div className="flex items-center justify-between gap-2">
          {/* Side filter */}
          <div className="flex items-center gap-1">
            <FilterChip active={sideFilter === "all"}    onClick={() => setSideFilter("all")}>All</FilterChip>
            <FilterChip active={sideFilter === "seller"} onClick={() => setSideFilter("seller")}>Seller</FilterChip>
            <FilterChip active={sideFilter === "buyer"}  onClick={() => setSideFilter("buyer")}>Buyer</FilterChip>
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1">
            <FilterChip active={statusFilter === "due"}     onClick={() => setStatusFilter("due")}>Due</FilterChip>
            <FilterChip active={statusFilter === "snoozed"} onClick={() => setStatusFilter("snoozed")}>
              Snoozed{snoozedLogs.length > 0 ? ` (${snoozedLogs.length})` : ""}
            </FilterChip>
          </div>
        </div>
      </div>

      {/* Empty state when filters yield nothing */}
      {statusFilter === "due" && !hasActiveResults && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40">
            {q || sideFilter !== "all" ? "No reminders match the current filter" : "No active reminders"}
          </p>
        </div>
      )}

      {/* Urgency groups — only shown in "due" view, empty groups render nothing */}
      {statusFilter === "due" && (["escalated", "overdue", "due_today", "upcoming"] as const).map((groupKey) => {
        const cards = grouped[groupKey];
        if (cards.length === 0) return null;
        const cfg = GROUP_CONFIG[groupKey];
        const isCollapsed = collapsed[groupKey];

        return (
          <div key={groupKey} className="space-y-2">
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${cfg.headerCls}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.labelCls}`}>{cfg.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>{cards.length}</span>
              </div>
              <button
                onClick={() => toggleCollapse(groupKey)}
                className="text-xs text-slate-900/40 hover:text-slate-900/60 transition-colors"
              >
                {isCollapsed ? "Show" : "Hide"}
              </button>
            </div>
            {!isCollapsed && (
              <div className="space-y-2">
                {cards.map((log) => (
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
                    onManualChase={handleManualChase}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Snoozed section — only shown in "snoozed" view */}
      {statusFilter === "snoozed" && (
        filteredSnoozed.length === 0 ? (
          <div className="glass-card px-5 py-6 text-center">
            <p className="text-sm text-slate-900/40">No snoozed reminders{q ? " matching filter" : ""}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSnoozed.map((log) => (
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
                onManualChase={handleManualChase}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
