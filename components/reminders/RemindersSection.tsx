"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import type { Contact } from "@/components/reminders/ReminderCard";

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
    anchorMilestone: { name: string } | null;
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

type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";

const GROUP_CONFIG: Record<UrgencyGroup, { label: string; headerCls: string; labelCls: string; badgeCls: string }> = {
  escalated: { label: "Escalated",  headerCls: "bg-red-50/70 border border-red-200",       labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700"       },
  overdue:   { label: "Overdue",    headerCls: "bg-orange-50/70 border border-orange-100", labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700" },
  due_today: { label: "Due today",  headerCls: "bg-amber-50/60 border border-amber-100",   labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700"   },
  upcoming:  { label: "Coming up",  headerCls: "bg-white/30 border border-white/50",        labelCls: "text-slate-900/60", badgeCls: "bg-white/60 text-slate-900/60" },
};


const SNOOZE_OPTIONS = [
  { label: "24 h",   hours: 24 },
  { label: "48 h",   hours: 48 },
  { label: "72 h",   hours: 72 },
  { label: "7 days", hours: 168 },
];

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

function stripChase(name: string) {
  return name.replace(/^Chase:\s*/i, "");
}

function classifyActive(log: ReminderLog, today: Date): UrgencyGroup {
  const openTask = log.chaseTasks.find((t) => t.status === "pending") ?? null;
  if (openTask?.priority === "escalated") return "escalated";
  const due = new Date(log.nextDueDate); due.setHours(0, 0, 0, 0);
  const taskDue = openTask ? (() => { const d = new Date(openTask.dueDate); d.setHours(0, 0, 0, 0); return d; })() : null;
  if (due < today || (taskDue && taskDue < today)) return "overdue";
  if (due.getTime() === today.getTime()) return "due_today";
  return "upcoming";
}

function RowSnoozeMenu({ taskId, onSnooze }: { taskId: string; onSnooze: (taskId: string, hours: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        title="Snooze this reminder"
        style={{ fontSize: 10, color: "rgba(15,23,42,0.40)", padding: "3px 7px", borderRadius: 6, border: "0.5px solid rgba(15,23,42,0.12)", background: "rgba(255,255,255,0.60)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
      >
        🕐
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 right-0 z-30 agent-dropdown-in" style={{ background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)", minWidth: 110 }}>
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.hours} onClick={() => { onSnooze(taskId, opt.hours); setOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function SideSnoozeMenu({ taskIds, onSnooze, disabled }: { taskIds: string[]; onSnooze: (taskId: string, hours: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        className="agent-btn agent-btn-sm agent-btn-ghost"
      >
        🕐 Snooze all
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-30 agent-dropdown-in" style={{ background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)", minWidth: 110 }}>
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.hours} onClick={() => { taskIds.forEach((id) => onSnooze(id, opt.hours)); setOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyColumn({ side }: { side: "seller" | "buyer" }) {
  const isSeller = side === "seller";
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 14, background: isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)", border: `0.5px solid ${isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)"}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", borderBottom: `0.5px solid ${isSeller ? "rgba(234,88,12,0.10)" : "rgba(59,130,246,0.10)"}`, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSeller ? "#ea580c" : "#3b82f6", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isSeller ? "#ea580c" : "#3b82f6" }}>{isSeller ? "Seller" : "Buyer"}</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>{isSeller ? "Seller" : "Buyer"} is all up to date</span>
      </div>
    </div>
  );
}

function ColumnSection({
  logs,
  side,
  transactionId,
  propertyAddress,
  contacts,
  loading,
  handleComplete,
  handleSnooze,
  handleChased,
}: {
  logs: ReminderLog[];
  side: "seller" | "buyer";
  transactionId: string;
  propertyAddress: string;
  contacts: Contact[];
  loading: string | null;
  handleComplete: (taskId: string) => void;
  handleSnooze: (taskId: string, hours: number) => void;
  handleChased: (taskId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isSeller = side === "seller";
  const dotColor = isSeller ? "#ea580c" : "#3b82f6";
  const columnBg = isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)";
  const labelColor = isSeller ? "#ea580c" : "#3b82f6";

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const openTasks = logs.flatMap((log) => {
    const task = log.chaseTasks.find((t) => t.status === "pending");
    if (!task) return [];
    return [{ log, task }];
  });

  const milestones = openTasks.map(({ log, task }) => ({
    chaseTaskId: task.id,
    name: stripChase(log.reminderRule.name),
    chaseCount: task.chaseCount,
  }));

  const maxChaseCount = milestones.length > 0 ? Math.max(...milestones.map((m) => m.chaseCount)) : 0;
  const allTaskIds = openTasks.map(({ task }) => task.id);
  const chaseContacts = contacts.filter((c) =>
    isSeller
      ? ["vendor", "solicitor"].includes(c.roleType)
      : ["purchaser", "broker", "solicitor"].includes(c.roleType)
  );
  const effectiveContacts = chaseContacts.length > 0 ? chaseContacts : contacts;

  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 14, background: columnBg, border: `0.5px solid ${isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)"}`, display: "flex", flexDirection: "column" }}>
      {/* Column header */}
      <div style={{ padding: "8px 12px", borderBottom: `0.5px solid ${isSeller ? "rgba(234,88,12,0.10)" : "rgba(59,130,246,0.10)"}`, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>{isSeller ? "Seller" : "Buyer"}</span>
        <span style={{ fontSize: 10, color: "rgba(15,23,42,0.35)", marginLeft: "auto" }}>{logs.length} {logs.length === 1 ? "item" : "items"}</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, padding: "6px 0" }}>
        {logs.map((log, i) => {
          const task = log.chaseTasks.find((t) => t.status === "pending");
          const name = stripChase(log.reminderRule.name);
          const dueDate = new Date(log.nextDueDate); dueDate.setHours(0, 0, 0, 0);
          const isOverdue = dueDate < today;
          const isDueToday = dueDate.getTime() === today.getTime();
          const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
          const urgencyColor = task?.priority === "escalated" ? "#dc2626"
            : isOverdue ? "#ea580c"
            : isDueToday ? "#d97706"
            : "rgba(15,23,42,0.35)";
          const urgencyLabel = task?.priority === "escalated" ? "Escalated"
            : isOverdue ? `${daysOverdue}d overdue`
            : isDueToday ? "Due today"
            : task ? null
            : `From ${formatDate(log.nextDueDate)}`;

          return (
            <div
              key={log.id}
              style={{ padding: "7px 12px", borderTop: i > 0 ? "0.5px solid rgba(15,23,42,0.06)" : undefined, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.80)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                {urgencyLabel && (
                  <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 600, color: urgencyColor }}>{urgencyLabel}</p>
                )}
              </div>
              {task && (
                <>
                  <RowSnoozeMenu taskId={task.id} onSnooze={handleSnooze} />
                  <button
                    onClick={() => handleComplete(task.id)}
                    disabled={loading === task.id}
                    title="Confirm milestone done"
                    style={{ fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.45)", padding: "3px 8px", borderRadius: 6, border: "0.5px solid rgba(15,23,42,0.12)", background: "rgba(255,255,255,0.60)", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    ✓ Done
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Chase + Snooze all */}
      {openTasks.length > 0 && (
        <div style={{ padding: "8px 12px", borderTop: "0.5px solid rgba(15,23,42,0.06)", display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="agent-btn agent-btn-sm agent-btn-primary flex-1"
          >
            {milestones.length === 1 ? "Chase" : `Chase all (${milestones.length})`}
          </button>
          <SideSnoozeMenu taskIds={allTaskIds} onSnooze={handleSnooze} disabled={loading !== null} />
        </div>
      )}

      {drawerOpen && (
        <ChaseDrawer
          chaseTaskId={milestones[0]?.chaseTaskId ?? ""}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
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

export function RemindersSection({
  transactionId,
  reminderLogs,
  contacts = [],
  propertyAddress = "",
}: Props) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    escalated: false,
    overdue: false,
    due_today: false,
    upcoming: true,
    snoozed: true,
    completed: true,
  });

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activeLogs = reminderLogs.filter((l) =>
    l.status === "active" && !(l.snoozedUntil && new Date(l.snoozedUntil) > now)
  );
  const snoozedLogs = reminderLogs.filter(
    (l) => l.status === "active" && l.snoozedUntil && new Date(l.snoozedUntil) > now
  );
  const completedLogs = reminderLogs.filter(
    (l) => l.status === "completed" || l.status === "inactive"
  );

  const grouped: Record<UrgencyGroup, ReminderLog[]> = { escalated: [], overdue: [], due_today: [], upcoming: [] };
  for (const log of activeLogs) {
    grouped[classifyActive(log, today)].push(log);
  }

  function act(id: string, fn: () => Promise<unknown>) {
    setLoading(id);
    startTransition(async () => {
      try { await fn(); } finally { setLoading(null); }
    });
  }

  function handleComplete(taskId: string) { act(taskId, () => completeTaskAction(taskId, pathname)); }
  function handleSnooze(taskId: string, hours: number) { act(taskId, () => snoozeTaskAction(taskId, hours, pathname)); }
  function handleWakeup(logId: string) { act(logId, () => wakeupReminderAction(logId, pathname)); }
  function handleChased(taskId: string) { act(taskId, () => advanceChaseTaskAction(taskId, pathname)); }

  async function runEngine() {
    setLoading("engine");
    startTransition(async () => {
      try { await runReminderEngineAction(pathname); } finally { setLoading(null); }
    });
  }

  function toggleCollapse(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  const escalatedCount = grouped.escalated.length;

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
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
          disabled={loading === "engine"}
          className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
        >
          {loading === "engine" ? "Running…" : "↻ Run engine"}
        </button>
      </div>

      {/* Empty state */}
      {activeLogs.length === 0 && snoozedLogs.length === 0 && completedLogs.length === 0 && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40">No active reminders</p>
          <p className="text-xs text-slate-900/30 mt-1">Reminders are set up — they&apos;ll appear here as they come due.</p>
        </div>
      )}

      {/* Urgency groups */}
      {(["escalated", "overdue", "due_today", "upcoming"] as const).map((groupKey) => {
        const logs = grouped[groupKey];
        if (logs.length === 0) return null;
        const cfg = GROUP_CONFIG[groupKey];
        const isCollapsed = collapsed[groupKey];

        const buyerLogs   = logs.filter((l) => l.reminderRule.targetMilestoneCode?.startsWith("PM"));
        const sellerLogs  = logs.filter((l) => !l.reminderRule.targetMilestoneCode?.startsWith("PM"));

        return (
          <div key={groupKey} className="glass-card overflow-hidden rounded-[12px]">
            <div className="agent-acc-hdr" style={{ borderBottom: "none" }}>
              <div className="flex items-center gap-2">
                <span className={`agent-acc-title ${cfg.labelCls}`}>{cfg.label}</span>
                <span className="agent-badge">{logs.length}</span>
              </div>
              <button onClick={() => toggleCollapse(groupKey)} className="text-[10px] agent-link agent-link-muted">
                {isCollapsed ? "Show" : "Hide"}
              </button>
            </div>
            <div className={`agent-acc ${!isCollapsed ? "open" : ""}`}>
              <div className="agent-acc-in">
                <div style={{ padding: "12px 14px 14px", display: "flex", gap: 10 }}>
                  {sellerLogs.length > 0
                    ? <ColumnSection logs={sellerLogs} side="seller" transactionId={transactionId} propertyAddress={propertyAddress} contacts={contacts} loading={loading} handleComplete={handleComplete} handleSnooze={handleSnooze} handleChased={handleChased} />
                    : <EmptyColumn side="seller" />}
                  {buyerLogs.length > 0
                    ? <ColumnSection logs={buyerLogs} side="buyer" transactionId={transactionId} propertyAddress={propertyAddress} contacts={contacts} loading={loading} handleComplete={handleComplete} handleSnooze={handleSnooze} handleChased={handleChased} />
                    : <EmptyColumn side="buyer" />}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Snoozed */}
      {snoozedLogs.length > 0 && (
        <div className="glass-card overflow-hidden rounded-[12px]">
          <div className="agent-acc-hdr" style={{ borderBottom: "none" }}>
            <div className="flex items-center gap-2">
              <span className="agent-acc-title text-purple-700">Snoozed</span>
              <span className="agent-badge">{snoozedLogs.length}</span>
            </div>
            <button onClick={() => toggleCollapse("snoozed")} className="text-[10px] agent-link agent-link-muted">
              {collapsed.snoozed ? "Show" : "Hide"}
            </button>
          </div>
          <div className={`agent-acc ${!collapsed.snoozed ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div className="space-y-1.5 p-4">
                {snoozedLogs.map((log) => (
                  <div key={log.id} className="glass-subtle rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900/80 truncate">
                        {stripChase(log.reminderRule.name)}
                      </p>
                      {log.snoozedUntil && (
                        <p className="text-xs text-slate-900/40 mt-0.5">
                          Wakes {new Date(log.snoozedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleWakeup(log.id)}
                      disabled={loading === log.id}
                      className="text-[10px] agent-link"
                    >
                      Wake up
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed */}
      {completedLogs.length > 0 && (
        <div className="glass-card overflow-hidden rounded-[12px]">
          <div className="agent-acc-hdr" style={{ borderBottom: "none" }}>
            <div className="flex items-center gap-2">
              <span className="agent-acc-title text-slate-900/50">Completed</span>
              <span className="agent-badge">{completedLogs.length}</span>
            </div>
            <button onClick={() => toggleCollapse("completed")} className="text-[10px] agent-link agent-link-muted">
              {collapsed.completed ? "Show" : "Hide"}
            </button>
          </div>
          <div className={`agent-acc ${!collapsed.completed ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div className="space-y-1.5 p-4">
                {completedLogs.map((log) => (
                  <div key={log.id} className="glass-subtle rounded-xl px-4 py-2.5">
                    <p className="text-xs font-medium text-slate-900/60">{stripChase(log.reminderRule.name)}</p>
                    <p className="text-xs text-slate-900/40 mt-0.5 capitalize">
                      {log.status}{log.statusReason ? ` · ${log.statusReason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
