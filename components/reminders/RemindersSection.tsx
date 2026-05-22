"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { usePathname } from "next/navigation";
import { formatDate, toUKDateStr } from "@/lib/utils";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { Contact } from "@/components/reminders/ReminderCard";
import { AutomatedEmailsCard } from "@/components/reminders/AutomatedEmailsCard";
import type { AutomatedEmailsPreview } from "@/lib/services/automated-emails-preview";

// Per-fallback-kind chip text + tooltip. Mirrors the canonical versions in
// components/reminders/AgentRemindersList.tsx (kept duplicated here to keep
// the file self-contained — DRY refactor to a shared module is a small
// future cleanup). Five FallbackKind values are surfaced; any new kind
// gets a generic "Manual handoff" fallback.
function fallbackChipText(kind: string): string {
  switch (kind) {
    case "client_opted_out":          return "Client opted out — manual";
    case "max_chases_exhausted":      return "Chased twice — manual";
    case "days_cap_exhausted":        return "14d silent — manual";
    case "no_email_on_contact":       return "No email — manual";
    case "no_portalToken_on_contact": return "No portal — manual";
    default:                          return "Manual handoff";
  }
}
function fallbackChipTitle(kind: string): string {
  switch (kind) {
    case "client_opted_out":
      return "Client chased automatically, then opted out. Now manual — please follow up.";
    case "max_chases_exhausted":
      return "Client was chased twice automatically with no response. Manual chase needed.";
    case "days_cap_exhausted":
      return "Client has been silent for 14 days since the first chase. Manual chase needed.";
    case "no_email_on_contact":
      return "Can't chase automatically — the client contact has no email address. Manual chase needed.";
    case "no_portalToken_on_contact":
      return "Can't chase automatically — the client contact has no portal access. Manual chase needed.";
    default:
      return "Manual chase needed.";
  }
}

type ChaseTask = {
  id: string;
  status: string;
  priority: string;
  chaseCount: number;
  dueDate: Date;
  fallbackKind: string | null;
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
  // Pending + sent-today + predicted-upcoming automated emails for this
  // file. Surfaces as a compact card at the top of the tab; clicking
  // opens a right-side drawer with the full grouped breakdown. Optional
  // for callers that haven't yet wired it; defaults to empty (card
  // shows the muted "no automated emails" line).
  automatedEmails?: AutomatedEmailsPreview;
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

function classifyActive(log: ReminderLog, todayStr: string): UrgencyGroup {
  const openTask = log.chaseTasks.find((t) => t.status === "pending") ?? null;
  if (openTask?.priority === "escalated") return "escalated";
  const dueStr = toUKDateStr(log.nextDueDate);
  const taskDueStr = openTask ? toUKDateStr(openTask.dueDate) : null;
  if (dueStr < todayStr || (taskDueStr && taskDueStr < todayStr)) return "overdue";
  if (dueStr === todayStr) return "due_today";
  return "upcoming";
}

function RowSnoozeMenu({ logId, taskId, onSnooze }: { logId: string; taskId: string; onSnooze: (logId: string, taskId: string, hours: number) => void }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleScroll() { close(); }
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
          if (!open && !closing && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, right: window.innerWidth - r.right });
          }
          if (open) { close(); } else { setClosing(false); setOpen(true); }
        }}
        title="Snooze this reminder"
        style={{ fontSize: 10, color: "var(--agent-text-muted)", padding: "3px 7px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
      >
        🕐
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          data-theme={theme}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, right: pos.right,
            transform: "translateY(-100%)",
            zIndex: 9999,
            background: "var(--agent-surface-elevated)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--agent-border-default)", minWidth: 110,
          }}
        >
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.hours} onClick={() => { onSnooze(logId, taskId, opt.hours); close(); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function SideSnoozeMenu({ logIds, taskIds, onSnoozeAll, disabled }: { logIds: string[]; taskIds: string[]; onSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleScroll() { close(); }
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
          if (disabled) return;
          if (!open && !closing && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, left: r.left });
          }
          if (open) { close(); } else { setClosing(false); setOpen(true); }
        }}
        disabled={disabled}
        className="agent-btn agent-btn-sm agent-btn-ghost"
      >
        🕐 Snooze
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          data-theme={theme}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            transform: "translateY(-100%)",
            zIndex: 9999,
            background: "var(--agent-surface-elevated)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--agent-border-default)", minWidth: 110,
          }}
        >
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.hours} onClick={() => { onSnoozeAll(logIds, taskIds, opt.hours); close(); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
          ))}
        </div>,
        document.body
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
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontStyle: "italic" }}>{isSeller ? "Seller" : "Buyer"} is all up to date</span>
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
  handleSnoozeAll,
  handleChased,
}: {
  logs: ReminderLog[];
  side: "seller" | "buyer";
  transactionId: string;
  propertyAddress: string;
  contacts: Contact[];
  loading: string | null;
  handleComplete: (logId: string, taskId: string) => void;
  handleSnooze: (logId: string, taskId: string, hours: number) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  handleChased: (taskId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowsRef] = useAutoAnimate<HTMLDivElement>();
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
  const allLogIds  = openTasks.map(({ log })  => log.id);
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
        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", marginLeft: "auto" }}>{logs.length} {logs.length === 1 ? "item" : "items"}</span>
      </div>

      {/* Rows */}
      <div ref={rowsRef} style={{ flex: 1, padding: "6px 0" }}>
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
            : "var(--agent-text-muted)";
          const urgencyLabel = task?.priority === "escalated" ? "Escalated"
            : isOverdue ? `${daysOverdue}d overdue`
            : isDueToday ? "Due today"
            : task ? null
            : `From ${formatDate(log.nextDueDate)}`;

          return (
            <div
              key={log.id}
              style={{ padding: "7px 12px", borderTop: i > 0 ? "0.5px solid var(--agent-border-default)" : undefined, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</p>
                {urgencyLabel && (
                  <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 600, color: urgencyColor }}>{urgencyLabel}</p>
                )}
                {task?.fallbackKind && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 3,
                      padding: "1px 6px",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#92400e",
                      background: "#fef3c7",
                      border: "0.5px solid #fcd34d",
                      borderRadius: 4,
                      lineHeight: 1.4,
                    }}
                    title={fallbackChipTitle(task.fallbackKind)}
                  >
                    {fallbackChipText(task.fallbackKind)}
                  </span>
                )}
              </div>
              {task && (
                <>
                  <RowSnoozeMenu logId={log.id} taskId={task.id} onSnooze={handleSnooze} />
                  <button
                    onClick={() => handleComplete(log.id, task.id)}
                    disabled={loading === task.id}
                    title="Confirm milestone done"
                    style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
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
          <SideSnoozeMenu logIds={allLogIds} taskIds={allTaskIds} onSnoozeAll={handleSnoozeAll} disabled={loading !== null} />
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
  automatedEmails,
}: Props) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  // Optimistic hide: rows are dropped from the rendered list immediately on
  // action, without waiting for revalidatePath to round-trip. auto-animate
  // (attached to the list containers below) handles the fade-out + sibling
  // reflow. Reset whenever fresh server data arrives.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setHiddenIds(new Set());
  }, [reminderLogs]);
  const [snoozedListRef] = useAutoAnimate<HTMLDivElement>();
  const [completedListRef] = useAutoAnimate<HTMLDivElement>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    escalated: false,
    overdue: false,
    due_today: false,
    upcoming: true,
    snoozed: true,
    completed: true,
  });

  const now = new Date();
  const todayStr = toUKDateStr(now);

  const activeLogs = reminderLogs.filter((l) =>
    !hiddenIds.has(l.id) && l.status === "active" && !(l.snoozedUntil && new Date(l.snoozedUntil) > now)
  );
  const snoozedLogs = reminderLogs.filter(
    (l) => !hiddenIds.has(l.id) && l.status === "active" && l.snoozedUntil && new Date(l.snoozedUntil) > now
  );
  const completedLogs = reminderLogs.filter(
    (l) => !hiddenIds.has(l.id) && (l.status === "completed" || l.status === "inactive")
  );

  const grouped: Record<UrgencyGroup, ReminderLog[]> = { escalated: [], overdue: [], due_today: [], upcoming: [] };
  for (const log of activeLogs) {
    grouped[classifyActive(log, todayStr)].push(log);
  }

  function act(id: string, fn: () => Promise<unknown>) {
    setLoading(id);
    startTransition(async () => {
      try { await fn(); } finally { setLoading(null); }
    });
  }

  function handleComplete(logId: string, taskId: string) {
    setHiddenIds((prev) => new Set([...prev, logId]));
    setLoading(taskId);
    startTransition(async () => {
      try { await completeTaskAction(taskId, pathname); }
      finally { setLoading(null); }
    });
  }

  function handleSnooze(logId: string, taskId: string, hours: number) {
    setHiddenIds((prev) => new Set([...prev, logId]));
    setLoading(taskId);
    startTransition(async () => {
      try { await snoozeTaskAction(taskId, hours, pathname); }
      finally { setLoading(null); }
    });
  }

  function handleSnoozeAll(logIds: string[], taskIds: string[], hours: number) {
    setHiddenIds((prev) => new Set([...prev, ...logIds]));
    setLoading(taskIds[0] ?? "");
    startTransition(async () => {
      try { await Promise.all(taskIds.map((id) => snoozeTaskAction(id, hours, pathname))); }
      finally { setLoading(null); }
    });
  }

  function handleWakeup(logId: string) {
    setHiddenIds((prev) => new Set([...prev, logId]));
    setLoading(logId);
    startTransition(async () => {
      try { await wakeupReminderAction(logId, pathname); }
      finally { setLoading(null); }
    });
  }

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

      {/* Automated-emails preview (Phase 4 of the email-preview arc) —
        * compact one-line card at the top of the Reminders tab. Click opens
        * a right-side drawer with pending + sent today + predicted upcoming.
        * Only renders when the loader supplied data (optional prop). */}
      {automatedEmails && (
        <AutomatedEmailsCard data={automatedEmails} />
      )}

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
              <button onClick={() => toggleCollapse(groupKey)} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
                {isCollapsed ? "Show" : "Hide"}
              </button>
            </div>
            <div className={`agent-acc ${!isCollapsed ? "open" : ""}`}>
              <div className="agent-acc-in">
                <div style={{ padding: "12px 14px 14px", display: "flex", gap: 10 }}>
                  {sellerLogs.length > 0
                    ? <ColumnSection logs={sellerLogs} side="seller" transactionId={transactionId} propertyAddress={propertyAddress} contacts={contacts} loading={loading} handleComplete={handleComplete} handleSnooze={handleSnooze} handleSnoozeAll={handleSnoozeAll} handleChased={handleChased} />
                    : <EmptyColumn side="seller" />}
                  {buyerLogs.length > 0
                    ? <ColumnSection logs={buyerLogs} side="buyer" transactionId={transactionId} propertyAddress={propertyAddress} contacts={contacts} loading={loading} handleComplete={handleComplete} handleSnooze={handleSnooze} handleSnoozeAll={handleSnoozeAll} handleChased={handleChased} />
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
            <button onClick={() => toggleCollapse("snoozed")} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
              {collapsed.snoozed ? "Show" : "Hide"}
            </button>
          </div>
          <div className={`agent-acc ${!collapsed.snoozed ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div ref={snoozedListRef} className="space-y-1.5 p-4">
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
            <button onClick={() => toggleCollapse("completed")} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
              {collapsed.completed ? "Show" : "Hide"}
            </button>
          </div>
          <div className={`agent-acc ${!collapsed.completed ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div ref={completedListRef} className="space-y-1.5 p-4">
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
