"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, recordManualChaseAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import type { getAgentReminderLogs } from "@/lib/services/reminders";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";
type LastComm = { createdAt: Date; method: string | null };

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

function groupByFile(logs: AgentReminderLog[]): { txId: string; address: string; logs: AgentReminderLog[] }[] {
  const map = new Map<string, { txId: string; address: string; logs: AgentReminderLog[] }>();
  for (const log of logs) {
    const txId = log.transaction.id;
    if (!map.has(txId)) {
      map.set(txId, { txId, address: log.transaction.propertyAddress, logs: [] });
    }
    map.get(txId)!.logs.push(log);
  }
  return Array.from(map.values());
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

// Group border colours matching ReminderCard left-border colours
const GROUP_LEFT_BORDER: Record<UrgencyGroup | "snoozed", string> = {
  escalated: "#dc2626",
  overdue:   "#ea580c",
  due_today: "#d97706",
  upcoming:  "rgba(148,163,184,0.35)",
  snoozed:   "rgba(168,85,247,0.5)",
};

function GroupedFileCard({
  txId,
  address,
  logs,
  groupKey,
  lastCommByTx,
  activeCountByTx,
  loading,
  handleComplete,
  handleSnooze,
  handleEscalate,
  handleManualChase,
  handleChased,
}: {
  txId: string;
  address: string;
  logs: AgentReminderLog[];
  groupKey: UrgencyGroup;
  lastCommByTx: Map<string, LastComm>;
  activeCountByTx: Map<string, number>;
  loading: string | null;
  handleComplete: (taskId: string) => void;
  handleSnooze: (taskId: string, hours: number) => void;
  handleEscalate: (taskId: string) => void;
  handleManualChase: (taskId: string) => void;
  handleChased: (taskId: string) => void;
}) {
  const leftBorder = GROUP_LEFT_BORDER[groupKey];
  return (
    <div
      className="glass-card overflow-hidden"
      style={{ borderRadius: 20, borderLeft: `4px solid ${leftBorder}` }}
    >
      {/* Shared address header */}
      <div
        style={{
          padding: "10px 20px",
          background: "rgba(255,255,255,0.28)",
          borderBottom: "0.5px solid rgba(255,255,255,0.40)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link
          href={`/agent/transactions/${txId}`}
          style={{
            fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)",
            textDecoration: "none", flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {address} →
        </Link>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>
          {logs.length} reminders
        </span>
      </div>
      {/* Individual reminder rows */}
      {logs.map((log, i) => (
        <div key={log.id} style={i > 0 ? { borderTop: "0.5px solid rgba(255,255,255,0.35)" } : {}}>
          <ReminderCard
            log={log}
            transactionId={txId}
            contacts={log.transaction.contacts}
            propertyAddress={address}
            showAddressLink={false}
            isLoading={loading}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onEscalate={handleEscalate}
            onManualChase={handleManualChase}
            onChased={handleChased}
            grouped={true}
            lastComm={lastCommByTx.get(txId) ?? null}
            totalActiveOnFile={activeCountByTx.get(txId) ?? 1}
          />
        </div>
      ))}
    </div>
  );
}

export function AgentRemindersList({ logs }: { logs: AgentReminderLog[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "seller" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "snoozed">("active");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ escalated: true, overdue: true, due_today: true, upcoming: true });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [optimisticSnoozeAdd, setOptimisticSnoozeAdd] = useState(0);

  useEffect(() => {
    runReminderEngineAction("/agent/work-queue")
      .then(() => startTransition(() => router.refresh()))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHiddenIds(new Set());
    setOptimisticSnoozeAdd(0);
  }, [logs]);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const snoozedLogs    = logs.filter((l) => !hiddenIds.has(l.id) && l.snoozedUntil && new Date(l.snoozedUntil) > now);
  const nonSnoozedLogs = logs.filter((l) => !hiddenIds.has(l.id) && !(l.snoozedUntil && new Date(l.snoozedUntil) > now));

  // Pre-compute per-transaction data from ALL non-snoozed logs (before any filter)
  const lastCommByTx  = new Map<string, LastComm>();
  const activeCountByTx = new Map<string, number>();
  for (const log of nonSnoozedLogs) {
    const txId = log.transaction.id;
    activeCountByTx.set(txId, (activeCountByTx.get(txId) ?? 0) + 1);
    const comm = log.chaseTasks[0]?.communications?.[0];
    if (comm) {
      const existing = lastCommByTx.get(txId);
      if (!existing || new Date(comm.createdAt) > new Date(existing.createdAt)) {
        lastCommByTx.set(txId, comm);
      }
    }
  }

  const taskToLogId = new Map<string, string>();
  for (const log of logs) {
    for (const task of log.chaseTasks) {
      taskToLogId.set(task.id, log.id);
    }
  }

  function hideByTaskId(taskId: string) {
    const logId = taskToLogId.get(taskId);
    if (logId) setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
  }

  const q = search.toLowerCase().trim();

  function matchesFilter(l: AgentReminderLog) {
    if (q && !l.transaction.propertyAddress.toLowerCase().includes(q) && !l.reminderRule.name.toLowerCase().includes(q)) return false;
    if (sideFilter === "seller" && !l.reminderRule.targetMilestoneCode?.startsWith("VM")) return false;
    if (sideFilter === "buyer"  && !l.reminderRule.targetMilestoneCode?.startsWith("PM")) return false;
    return true;
  }

  const filteredActive  = nonSnoozedLogs.filter(matchesFilter);
  const filteredSnoozed = snoozedLogs.filter(matchesFilter);

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

  function handleComplete(taskId: string) {
    hideByTaskId(taskId);
    act(taskId, () => completeTaskAction(taskId, "/agent/work-queue"));
  }
  function handleSnooze(taskId: string, hours: number) {
    hideByTaskId(taskId);
    setOptimisticSnoozeAdd((n) => n + 1);
    act(taskId, () => snoozeTaskAction(taskId, hours, "/agent/work-queue"));
  }
  function handleEscalate(taskId: string) { act(taskId, () => escalateTaskAction(taskId, "/agent/work-queue")); }
  function handleWakeup(logId: string) {
    setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    act(logId, () => wakeupReminderAction(logId, "/agent/work-queue"));
  }
  function handleManualChase(taskId: string) { act(taskId, () => recordManualChaseAction(taskId, "/agent/work-queue")); }
  function handleChased(taskId: string) { act(taskId, () => advanceChaseTaskAction(taskId, "/agent/work-queue")); }

  function toggleCollapse(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  // Full empty state (zero logs, before any filter)
  if (logs.length === 0) {
    return (
      <div className="glass-card" style={{ padding: "40px 32px", textAlign: "center" }}>
        <CheckCircle weight="fill" style={{ width: 32, height: 32, color: "var(--agent-success)", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>All caught up</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
          No reminders due right now. We&rsquo;ll surface them here as files progress.
        </p>
      </div>
    );
  }

  const snoozedCount = snoozedLogs.length + optimisticSnoozeAdd;
  const hasActiveResults = filteredActive.length > 0;

  return (
    <div className="space-y-5">
      {/* Sticky filter bar — sections 4 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,245,236,0.93)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "0.5px solid rgba(255,200,160,0.28)",
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: -4,
        }}
      >
        <input
          type="text"
          placeholder="Search address or reminder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-base rounded-lg glass-subtle border-0 outline-none placeholder:text-slate-900/30 text-slate-900/80 mb-2"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <FilterChip active={sideFilter === "all"}    onClick={() => setSideFilter("all")}>All</FilterChip>
            <FilterChip active={sideFilter === "seller"} onClick={() => setSideFilter("seller")}>Seller</FilterChip>
            <FilterChip active={sideFilter === "buyer"}  onClick={() => setSideFilter("buyer")}>Buyer</FilterChip>
          </div>
          <div className="flex items-center gap-1">
            <FilterChip active={statusFilter === "active"}  onClick={() => setStatusFilter("active")}>Active</FilterChip>
            <FilterChip active={statusFilter === "snoozed"} onClick={() => setStatusFilter("snoozed")}>
              Snoozed{snoozedCount > 0 ? ` (${snoozedCount})` : ""}
            </FilterChip>
          </div>
        </div>
      </div>

      {/* Filtered empty states */}
      {statusFilter === "active" && !hasActiveResults && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40">
            {sideFilter !== "all"
              ? `No reminders for ${sideFilter === "seller" ? "Seller" : "Buyer"} right now.`
              : q
                ? "No reminders match the current filter."
                : "No active reminders."}
          </p>
        </div>
      )}

      {/* Urgency groups — "active" view */}
      {statusFilter === "active" && (["escalated", "overdue", "due_today", "upcoming"] as const).map((groupKey) => {
        const cards = grouped[groupKey];
        if (cards.length === 0) return null;
        const cfg = GROUP_CONFIG[groupKey];
        const isCollapsed = collapsed[groupKey];
        const fileGroups = groupByFile(cards);

        // Section ID maps to stat row anchors in page.tsx
        const sectionId = groupKey === "due_today" ? "section-due_today" : `section-${groupKey}`;

        return (
          <div key={groupKey} className="space-y-2" id={sectionId}>
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
                {fileGroups.map(({ txId, address, logs: fileLogs }) => {
                  if (fileLogs.length === 1) {
                    const log = fileLogs[0];
                    return (
                      <ReminderCard
                        key={log.id}
                        log={log}
                        transactionId={txId}
                        contacts={log.transaction.contacts}
                        propertyAddress={address}
                        showAddressLink
                        isLoading={loading}
                        onComplete={handleComplete}
                        onSnooze={handleSnooze}
                        onEscalate={handleEscalate}
                        onManualChase={handleManualChase}
                        onChased={handleChased}
                        lastComm={lastCommByTx.get(txId) ?? null}
                        totalActiveOnFile={activeCountByTx.get(txId) ?? 1}
                      />
                    );
                  }
                  return (
                    <GroupedFileCard
                      key={txId}
                      txId={txId}
                      address={address}
                      logs={fileLogs}
                      groupKey={groupKey}
                      lastCommByTx={lastCommByTx}
                      activeCountByTx={activeCountByTx}
                      loading={loading}
                      handleComplete={handleComplete}
                      handleSnooze={handleSnooze}
                      handleEscalate={handleEscalate}
                      handleManualChase={handleManualChase}
                      handleChased={handleChased}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Snoozed section — sorted by nextDueDate asc (= snooze end date asc, set by snoozeReminderLog) */}
      {statusFilter === "snoozed" && (
        filteredSnoozed.length === 0 ? (
          <div className="glass-card px-5 py-6 text-center">
            <p className="text-sm text-slate-900/40">No snoozed reminders{q ? " matching filter" : ""}.</p>
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
