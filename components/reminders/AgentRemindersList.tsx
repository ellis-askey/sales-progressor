"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock } from "@phosphor-icons/react";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, recordManualChaseAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import type { getAgentReminderLogs } from "@/lib/services/reminders";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";
type LastComm = { createdAt: Date; method: string | null };

// E1 semantic colour-coding (intentional, not canonical class — see ANIMATION_STANDARDS §E1).
// Backgrounds bumped to solid bg-X-50 (from /70 /60 /30 opacity suffixes) so headers pop
// on cool-toned themes instead of washing into the page. Borders kept at bg-X-200 / -100.
const GROUP_CONFIG: Record<UrgencyGroup, { label: string; headerCls: string; labelCls: string; badgeCls: string }> = {
  escalated: { label: "Escalated",  headerCls: "bg-red-50 border border-red-200",       labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700"       },
  overdue:   { label: "Overdue",    headerCls: "bg-orange-50 border border-orange-200", labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700" },
  due_today: { label: "Due today",  headerCls: "bg-amber-50 border border-amber-200",   labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700"   },
  upcoming:  { label: "Coming up",  headerCls: "bg-slate-50 border border-slate-200",   labelCls: "text-slate-900/60", badgeCls: "bg-slate-100 text-slate-900/60" },
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

// Group border colours matching ReminderCard left-border colours
const GROUP_LEFT_BORDER: Record<UrgencyGroup | "snoozed", string> = {
  escalated: "#dc2626",
  overdue:   "#ea580c",
  due_today: "#d97706",
  upcoming:  "rgba(148,163,184,0.35)",
  snoozed:   "rgba(168,85,247,0.5)",
};

const SNOOZE_OPTIONS_SPLIT = [
  { label: "24 h", hours: 24 },
  { label: "48 h", hours: 48 },
  { label: "72 h", hours: 72 },
  { label: "7 days", hours: 168 },
];

function SideSnoozeMenu({ logIds, taskIds, onSnoozeAll, disabled }: {
  logIds: string[];
  taskIds: string[];
  onSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (!open && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, left: r.left });
          }
          setOpen((p) => !p);
        }}
        disabled={disabled}
        className="agent-btn agent-btn-sm agent-btn-ghost"
        style={{ whiteSpace: "nowrap" }}
      >
        <Clock size={12} weight="regular" /> Snooze all
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          className="agent-dropdown-in"
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            transform: "translateY(-100%)",
            zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 110,
          }}
        >
          {SNOOZE_OPTIONS_SPLIT.map((opt) => (
            <button
              key={opt.hours}
              onClick={() => {
                onSnoozeAll(logIds, taskIds, opt.hours);
                setOpen(false);
              }}
              className="agent-dropdown-item"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function RowSnoozeMenu({ taskId, onSnooze }: {
  taskId: string;
  onSnooze: (taskId: string, hours: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (!open && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, right: window.innerWidth - r.right });
          }
          setOpen((p) => !p);
        }}
        title="Snooze"
        className="agent-btn agent-btn-sm agent-btn-secondary"
        style={{ flexShrink: 0 }}
      >
        <Clock size={12} weight="regular" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          className="agent-dropdown-in"
          style={{
            position: "fixed", top: pos.top, right: pos.right,
            transform: "translateY(-100%)",
            zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 110,
          }}
        >
          {SNOOZE_OPTIONS_SPLIT.map((opt) => (
            <button
              key={opt.hours}
              onClick={() => {
                onSnooze(taskId, opt.hours);
                setOpen(false);
              }}
              className="agent-dropdown-item"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function SideColumn({
  logs,
  side,
  txId,
  address,
  contacts,
  loading,
  exitingIds,
  handleComplete,
  handleSnooze,
  handleSnoozeAll,
  handleChased,
}: {
  logs: AgentReminderLog[];
  side: "seller" | "buyer";
  txId: string;
  address: string;
  contacts: AgentReminderLog["transaction"]["contacts"];
  loading: string | null;
  exitingIds: Set<string>;
  handleComplete: (taskId: string) => void;
  handleSnooze: (taskId: string, hours: number) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  handleChased: (taskId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSeller = side === "seller";
  const dotColor = isSeller ? "#ea580c" : "#3b82f6";
  const columnBg = isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)";
  const labelColor = isSeller ? "#ea580c" : "#3b82f6";

  const openTasks = logs.flatMap((log) => {
    const task = log.chaseTasks.find((t) => t.status === "pending");
    if (!task) return [];
    return [{ log, task }];
  });

  const milestones = openTasks.map(({ log, task }) => ({
    chaseTaskId: task.id,
    name: log.reminderRule.name.replace(/^Chase:\s*/i, ""),
    chaseCount: task.chaseCount,
  }));

  const maxChaseCount = milestones.length > 0 ? Math.max(...milestones.map((m) => m.chaseCount)) : 0;
  const allTaskIds = openTasks.map(({ task }) => task.id);
  const allLogIds  = openTasks.map(({ log })  => log.id);
  const chaseContacts = contacts.filter((c) =>
    isSeller
      ? ["vendor", "solicitor"].includes(c.roleType)
      : ["purchaser", "broker", "solicitor"].includes(c.roleType)
  );
  const effectiveContacts = chaseContacts.length > 0 ? chaseContacts : contacts;

  return (
    <div
      style={{
        flex: 1, minWidth: 0, borderRadius: 14,
        background: columnBg,
        border: `0.5px solid ${isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)"}`,
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Column header */}
      <div style={{
        padding: "8px 12px",
        borderBottom: `0.5px solid ${isSeller ? "rgba(234,88,12,0.10)" : "rgba(59,130,246,0.10)"}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>
          {isSeller ? "Seller" : "Buyer"}
        </span>
        {/* OLD: "{N} item / items" — Rule 3: "item" is generic; "reminder" matches the page's primary noun */}
        <span style={{ fontSize: 10, color: "rgba(15,23,42,0.35)", marginLeft: "auto" }}>
          {logs.length} {logs.length === 1 ? "reminder" : "reminders"}
        </span>
      </div>

      {/* Milestone rows */}
      <div style={{ flex: 1, padding: "6px 0" }}>
        {openTasks.map(({ log, task }, i) => {
          const name = log.reminderRule.name.replace(/^Chase:\s*/i, "");
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const dueDate = new Date(log.nextDueDate); dueDate.setHours(0, 0, 0, 0);
          const isOverdue = dueDate < today;
          const isDueToday = dueDate.getTime() === today.getTime();
          const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
          const urgencyColor = task.priority === "escalated" ? "#dc2626"
            : isOverdue ? "#ea580c"
            : isDueToday ? "#d97706"
            : "rgba(15,23,42,0.35)";
          const urgencyLabel = task.priority === "escalated" ? "Escalated"
            : isOverdue ? `${daysOverdue}d overdue`
            : isDueToday ? "Due today"
            : null;

          const isExiting = exitingIds.has(log.id);
          return (
            <div
              key={log.id}
              className={isExiting ? "agent-row-exit" : (loading === task.id ? "agent-row-flash" : undefined)}
              style={{
                padding: "7px 12px",
                borderTop: i > 0 ? `0.5px solid rgba(15,23,42,0.06)` : undefined,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.80)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </p>
                {urgencyLabel && (
                  <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 600, color: urgencyColor }}>
                    {urgencyLabel}
                  </p>
                )}
              </div>
              <RowSnoozeMenu taskId={task.id} onSnooze={handleSnooze} />
              {/* OLD: title="Confirm milestone done" — Rule 2 schema jargon (milestone → step) */}
              <button
                onClick={() => handleComplete(task.id)}
                disabled={loading === task.id || isExiting}
                title="Mark step done"
                className="agent-btn agent-btn-sm agent-btn-secondary"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                <CheckCircle size={12} weight="fill" /> Done
              </button>
            </div>
          );
        })}
      </div>

      {/* Column footer: Chase + Snooze */}
      {openTasks.length > 0 && (
        <div style={{
          padding: "8px 12px",
          borderTop: `0.5px solid rgba(15,23,42,0.06)`,
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="agent-btn agent-btn-sm agent-btn-primary"
            style={{ flex: 1, whiteSpace: "nowrap" }}
          >
            {milestones.length === 1 ? "Chase" : `Chase all (${milestones.length})`}
          </button>
          <SideSnoozeMenu
            logIds={allLogIds}
            taskIds={allTaskIds}
            onSnoozeAll={handleSnoozeAll}
            disabled={loading !== null}
          />
        </div>
      )}

      {/* Chase drawer */}
      {drawerOpen && (
        <ChaseDrawer
          chaseTaskId={milestones[0]?.chaseTaskId ?? ""}
          transactionId={txId}
          propertyAddress={address}
          milestoneName={milestones[0]?.name ?? ""}
          chaseCount={maxChaseCount}
          contacts={effectiveContacts}
          milestones={milestones.length > 1 ? milestones : undefined}
          onClose={() => setDrawerOpen(false)}
          onSent={() => {
            allTaskIds.forEach((id) => handleChased(id));
            setDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyColumn({ side }: { side: "seller" | "buyer" }) {
  const isSeller = side === "seller";
  const dotColor = isSeller ? "#ea580c" : "#3b82f6";
  const columnBg = isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)";
  const labelColor = isSeller ? "#ea580c" : "#3b82f6";

  return (
    <div
      style={{
        flex: 1, minWidth: 0, borderRadius: 14,
        background: columnBg,
        border: `0.5px solid ${isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)"}`,
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{
        padding: "8px 12px",
        borderBottom: `0.5px solid ${isSeller ? "rgba(234,88,12,0.10)" : "rgba(59,130,246,0.10)"}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>
          {isSeller ? "Seller" : "Buyer"}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>
          {isSeller ? "Seller" : "Buyer"} is all up to date
        </span>
      </div>
    </div>
  );
}

function SplitFileCard({
  txId,
  address,
  logs,
  groupKey,
  loading,
  exitingIds,
  handleComplete,
  handleSnooze,
  handleSnoozeAll,
  handleEscalate,
  handleManualChase,
  handleChased,
}: {
  txId: string;
  address: string;
  logs: AgentReminderLog[];
  groupKey: UrgencyGroup;
  loading: string | null;
  exitingIds: Set<string>;
  handleComplete: (taskId: string) => void;
  handleSnooze: (taskId: string, hours: number) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  handleEscalate: (taskId: string) => void;
  handleManualChase: (taskId: string) => void;
  handleChased: (taskId: string) => void;
}) {
  const leftBorder = GROUP_LEFT_BORDER[groupKey];

  const sellerLogs = logs.filter((l) => l.reminderRule.targetMilestoneCode?.startsWith("VM"));
  const buyerLogs  = logs.filter((l) => l.reminderRule.targetMilestoneCode?.startsWith("PM"));
  const otherLogs  = logs.filter((l) => {
    const code = l.reminderRule.targetMilestoneCode;
    return !code?.startsWith("VM") && !code?.startsWith("PM");
  });

  // Any logs without a clear side go into seller column as a fallback
  const effectiveSellerLogs = [...sellerLogs, ...otherLogs];

  const contacts = logs[0]?.transaction.contacts ?? [];

  return (
    <div
      className="agent-glass-strong"
      style={{ borderRadius: 20, borderLeft: `4px solid ${leftBorder}` }}
    >
      {/* Address header — agent-card-hdr canonical with semi-transparent bg + tighter padding.
       * borderRadius inline override clips header bg to the outer card's rounded corners
       * (16px left = 20px outer minus 4px borderLeft). overflow:hidden NOT applied to outer
       * so absolute-positioned dropdowns (RowSnoozeMenu / SideSnoozeMenu) can extend
       * beyond the card without being clipped. */}
      <div className="agent-card-hdr" style={{
        background: "rgba(255,255,255,0.28)",
        padding: "10px 20px",
        borderRadius: "16px 20px 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
          <Link
            href={`/agent/transactions/${txId}`}
            className="agent-link"
            style={{
              fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)",
              textDecoration: "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {address}
          </Link>
          {/* Arrow extracted to sibling span — outside the anchor so agent-link's
              hover underline does not extend across the arrow. */}
          <span aria-hidden style={{ fontSize: 13, color: "var(--agent-text-muted)", flexShrink: 0 }}>→</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
          {logs.length} {logs.length === 1 ? "reminder" : "reminders"}
        </span>
      </div>

      {/* Two-column body — always both sides; empty side shows placeholder.
       * wq-split-body class enables mobile stacking via @media in globals.css. */}
      <div className="wq-split-body" style={{ padding: "12px 14px 14px", display: "flex", gap: 10 }}>
        {effectiveSellerLogs.length > 0
          ? <SideColumn logs={effectiveSellerLogs} side="seller" txId={txId} address={address} contacts={contacts} loading={loading} exitingIds={exitingIds} handleComplete={handleComplete} handleSnooze={handleSnooze} handleSnoozeAll={handleSnoozeAll} handleChased={handleChased} />
          : <EmptyColumn side="seller" />}
        {buyerLogs.length > 0
          ? <SideColumn logs={buyerLogs} side="buyer" txId={txId} address={address} contacts={contacts} loading={loading} exitingIds={exitingIds} handleComplete={handleComplete} handleSnooze={handleSnooze} handleSnoozeAll={handleSnoozeAll} handleChased={handleChased} />
          : <EmptyColumn side="buyer" />}
      </div>
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
  // Initial collapse state: Escalated + Overdue expanded by default (act-now categories);
  // Due Today + Coming Up collapsed (scan-when-time-permits). Matches the urgency-colour
  // hierarchy and the agent's natural priority sweep. Locked 2026-05-12 per Ellis.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ escalated: false, overdue: false, due_today: true, upcoming: true });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [optimisticSnoozeAdd, setOptimisticSnoozeAdd] = useState(0);

  useEffect(() => {
    runReminderEngineAction("/agent/work-queue")
      .then(() => startTransition(() => router.refresh()))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHiddenIds(new Set());
    setExitingIds(new Set());
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

  // Two-step exit: setExitingIds → 150ms (matches agent-row-exit duration) → hideByTaskId
  // + fire server action. agent-row-exit's `forwards` fill keeps the row collapsed until
  // the React filter removes it via hiddenIds.
  function handleComplete(taskId: string) {
    const logId = taskToLogId.get(taskId);
    if (logId) setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      hideByTaskId(taskId);
      act(taskId, () => completeTaskAction(taskId, "/agent/work-queue"));
    }, 150);
  }
  function handleSnooze(taskId: string, hours: number) {
    const logId = taskToLogId.get(taskId);
    if (logId) setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      hideByTaskId(taskId);
      setOptimisticSnoozeAdd((n) => n + 1);
      act(taskId, () => snoozeTaskAction(taskId, hours, "/agent/work-queue"));
    }, 150);
  }
  function handleSnoozeAll(logIds: string[], taskIds: string[], hours: number) {
    setExitingIds((prev) => {
      const next = new Set(prev);
      logIds.forEach((id) => next.add(id));
      return next;
    });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); logIds.forEach((id) => next.add(id)); return next; });
      setOptimisticSnoozeAdd((n) => n + taskIds.length);
      act(taskIds[0] ?? "", () => Promise.all(taskIds.map((id) => snoozeTaskAction(id, hours, "/agent/work-queue"))));
    }, 150);
  }
  function handleEscalate(taskId: string) { act(taskId, () => escalateTaskAction(taskId, "/agent/work-queue")); }
  function handleWakeup(logId: string) {
    setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
      act(logId, () => wakeupReminderAction(logId, "/agent/work-queue"));
    }, 150);
  }
  function handleManualChase(taskId: string) { act(taskId, () => recordManualChaseAction(taskId, "/agent/work-queue")); }
  function handleChased(taskId: string) { act(taskId, () => advanceChaseTaskAction(taskId, "/agent/work-queue")); }

  function toggleCollapse(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  // Full empty state (zero logs, before any filter)
  if (logs.length === 0) {
    return (
      <div className="agent-glass-strong" style={{ padding: "40px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
        <CheckCircle weight="fill" style={{ width: 32, height: 32, color: "var(--agent-success)", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>All caught up</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
          {/* OLD: "No reminders due right now. We'll surface them here as files progress." — Rule 1 (system self-reference) */}
          No reminders due right now. They&rsquo;ll appear here as files move forward.
        </p>
      </div>
    );
  }

  const snoozedCount = snoozedLogs.length + optimisticSnoozeAdd;
  const hasActiveResults = filteredActive.length > 0;

  return (
    <div className="space-y-5">
      {/* Sticky filter bar — agent-glass-strong surface (same canonical as FileAlertsStrip)
       * so the bar pops on cool-toned themes instead of merging with the page bg. */}
      <div
        className="agent-glass-strong"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderRadius: "var(--agent-radius-xl)",
          padding: "10px 16px",
        }}
      >
        <input
          type="text"
          placeholder="Search address or reminder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="agent-input agent-input-sm"
          style={{ width: "100%", marginBottom: 10, fontSize: 13 }}
        />
        <div className="wq-filter-pills" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "all"    ? " on" : ""}`} onClick={() => setSideFilter("all")}>All</button>
            <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "seller" ? " on" : ""}`} onClick={() => setSideFilter("seller")}>Seller</button>
            <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "buyer"  ? " on" : ""}`} onClick={() => setSideFilter("buyer")}>Buyer</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={`agent-segment-pill agent-segment-pill-sm${statusFilter === "active"  ? " on" : ""}`} onClick={() => setStatusFilter("active")}>Active</button>
            <button className={`agent-segment-pill agent-segment-pill-sm${statusFilter === "snoozed" ? " on" : ""}`} onClick={() => setStatusFilter("snoozed")}>
              Snoozed{snoozedCount > 0 ? ` (${snoozedCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Filtered empty states */}
      {statusFilter === "active" && !hasActiveResults && (
        <div className="agent-glass-strong" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>
            {/* OLD: "No reminders match the current filter." — Rule 3 (active/specific) — Stage 3 voice review */}
            {sideFilter !== "all"
              ? `No reminders for ${sideFilter === "seller" ? "Seller" : "Buyer"} right now.`
              : q
                ? "No reminders match."
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
            {/* E1 exception preserved: semantic colour-coded header is the primary
                urgency signal — intentionally NOT agent-acc-hdr. See ANIMATION_STANDARDS §E1. */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${cfg.headerCls}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.labelCls}`}>{cfg.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>{cards.length}</span>
              </div>
              <button
                onClick={() => toggleCollapse(groupKey)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 12 }}
              >
                {isCollapsed ? "Show" : "Hide"}
              </button>
            </div>
            {/* agent-acc / agent-acc-in: mounted always, animated height transition */}
            <div className={`agent-acc${!isCollapsed ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="space-y-2">
                  {fileGroups.map(({ txId, address, logs: fileLogs }) => {
                    return (
                      <SplitFileCard
                        key={txId}
                        txId={txId}
                        address={address}
                        logs={fileLogs}
                        groupKey={groupKey}
                        loading={loading}
                        exitingIds={exitingIds}
                        handleComplete={handleComplete}
                        handleSnooze={handleSnooze}
                        handleSnoozeAll={handleSnoozeAll}
                        handleEscalate={handleEscalate}
                        handleManualChase={handleManualChase}
                        handleChased={handleChased}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Snoozed section — sorted by nextDueDate asc (= snooze end date asc, set by snoozeReminderLog) */}
      {statusFilter === "snoozed" && (
        filteredSnoozed.length === 0 ? (
          <div className="agent-glass-strong" style={{ padding: "28px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
            {/* OLD: "No snoozed reminders matching filter." — Rule 3 smoother active phrasing — Stage 3 voice review */}
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>{q ? "No matching snoozed reminders." : "No snoozed reminders."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSnoozed.map((log) => (
              // Wake-now exit: wrap so agent-row-exit collapses height + opacity in 150ms
              // before handleWakeup removes the card via hiddenIds. Matches the four-path
              // exit pattern (Done / row snooze / side snooze / Wake now).
              <div key={log.id} className={exitingIds.has(log.id) ? "agent-row-exit" : ""}>
                <ReminderCard
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
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
