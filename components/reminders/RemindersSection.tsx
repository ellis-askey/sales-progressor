"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pill } from "@/components/ui/Pill";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { usePathname } from "next/navigation";
import { formatDate, toUKDateStr } from "@/lib/utils";
import { classifyReminder, chaseBadgeLabel } from "@/lib/reminders/classify";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, advanceChaseTaskAction, chaseNowFromLogAction } from "@/app/actions/tasks";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { Contact } from "@/components/reminders/ReminderCard";
import { AutomatedEmailsCard } from "@/components/reminders/AutomatedEmailsCard";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { AutomatedEmailsPreview } from "@/lib/services/automated-emails-preview";
import { useTabBadge } from "@/components/transaction/PropertyFileTabs";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CaretDown } from "@phosphor-icons/react";

// Per-fallback-kind chip text + tooltip. Mirrors the canonical versions in
// components/reminders/AgentRemindersList.tsx (kept duplicated here to keep
// the file self-contained — DRY refactor to a shared module is a small
// future cleanup). Five FallbackKind values are surfaced; any new kind
// gets a generic "Manual handoff" fallback.
function fallbackChipText(kind: string): string {
  switch (kind) {
    case "client_opted_out":          return "Opted out, chase manually";
    case "max_chases_exhausted":      return "Chased twice (manual)";
    case "days_cap_exhausted":        return "14d silent (manual)";
    case "no_email_on_contact":       return "Add email to send updates";
    case "no_portalToken_on_contact": return "Portal access needed";
    case "client_emails_paused":      return "Client emails paused (manual)";
    default:                          return "Manual handoff";
  }
}
function fallbackChipTitle(kind: string): string {
  switch (kind) {
    case "client_opted_out":
      return "This client opted out of automated updates. Follow up manually.";
    case "max_chases_exhausted":
      return "We chased the client twice with no response. Follow up manually.";
    case "days_cap_exhausted":
      return "Client has been silent for 14 days since the first chase. Manual chase needed.";
    case "no_email_on_contact":
      return "We can't send this client automated updates yet. Add an email to switch chasing back on, or follow up manually.";
    case "no_portalToken_on_contact":
      return "This client has no portal access yet, so we can't send automated updates. Follow up manually.";
    case "client_emails_paused":
      return "Client emails are paused on this file. Chase manually if needed.";
    default:
      return "Manual chase needed.";
  }
}

type ChaseTask = {
  id: string;
  status: string;
  priority: string;
  chaseCount: number;
  manualChaseCount: number;
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
  // Tx status — when "on_hold", the auto-emails card renders a paused
  // state instead of pending/upcoming lists. When the file is reactivated
  // automation resumes naturally.
  transactionStatus?: "active" | "on_hold" | "completed" | "withdrawn" | "draft" | string;
};

// Urgency ranking drives the flat priority-stack order (worst first) and the
// per-row chip. Same buckets the tab-badge count uses, kept in lock-step.
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";

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
  // Strip the "Chase: " prefix AND any " (seller)" / " (buyer)" side suffix.
  // Reminder rules in the DB are still disambiguated by side suffix (e.g.
  // "Chase: Management pack received (buyer)" vs "(seller)") but the
  // RemindersSection renders each card under an explicit Seller / Buyer
  // column header, so the suffix is redundant in the row title.
  return name
    .replace(/^Chase:\s*/i, "")
    .replace(/\s*\((?:buyer|seller)\)\s*$/i, "");
}

// Short, friendly label for the snooze toast — matches the duration option
// the user picked. Mirrors the SNOOZE_OPTIONS labels but in past tense.
function snoozeToastLabel(hours: number): string {
  if (hours < 24) return `Snoozed for ${hours}h`;
  const days = Math.round(hours / 24);
  return `Snoozed for ${days} ${days === 1 ? "day" : "days"}`;
}

function classifyActive(log: ReminderLog, now: Date, optimisticNextDue: Date | null): UrgencyGroup {
  // Defer to the canonical classifier (lib/reminders/classify.ts) so the
  // visible bucket and every count formula stay in lock-step.
  //
  // The classifier doesn't know about optimistic state — when the user
  // chases a row, we want it to *visually* move to Coming Up immediately
  // even though the underlying log.chaseTasks prop hasn't refreshed yet.
  // Apply the optimistic future-nextDueDate on top of the server data
  // before classifying, so an active chase pushes the row out of overdue.
  const effective: typeof log = optimisticNextDue && optimisticNextDue > new Date(log.nextDueDate)
    ? { ...log, nextDueDate: optimisticNextDue }
    : log;
  const bucket = classifyReminder(effective, now);
  // The bucket "snoozed" can't reach here — caller filters snoozed logs out.
  // "inactive" also can't reach here — caller restricts to status=active.
  return bucket === "snoozed" || bucket === "inactive" ? "upcoming" : bucket;
}

function RowSnoozeMenu({ logId, taskId, onSnooze }: { logId: string; taskId: string; onSnooze: (logId: string, taskId: string, hours: number) => void }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }

  // Gate listener registration on `open` — see ChaseDrawer for the same
  // pattern. Registering unconditionally on mount means any prior click
  // anywhere on the page fires close(), flipping `closing` to true even
  // though the menu was never open. After that, the onClick's
  // `!open && !closing` guard blocks setPos, so the menu never gets a
  // position and never renders. Gating the listener fixes that.
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleScroll() { close(); }
    if (open) {
      document.addEventListener("mousedown", handle);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

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
        style={{ fontSize: 12, color: "var(--agent-text-muted)", height: 28, padding: "0 10px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
      >
        🕐
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        // Outer wrapper holds the positioning transform (translateY(-100%)
        // anchors the menu's bottom edge above the trigger). Inner box runs
        // the slide-in animation. They MUST be split — the animation's
        // transform keyframes would otherwise override the inline -100%
        // and the menu would render covering the button instead of above it.
        <div
          style={{
            position: "fixed", top: pos.top, right: pos.right,
            transform: "translateY(-100%)",
            zIndex: 9999,
          }}
        >
          <div
            data-theme={theme}
            className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
            onAnimationEnd={() => { if (closing) setClosing(false); }}
            style={{
              background: "var(--agent-surface-elevated)", borderRadius: 12, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--agent-border-default)", minWidth: 110,
            }}
          >
            {SNOOZE_OPTIONS.map((opt) => (
              <button key={opt.hours} onClick={() => { onSnooze(logId, taskId, opt.hours); close(); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
            ))}
          </div>
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

  // See RowSnoozeMenu above for why the listener is gated on `open`.
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleScroll() { close(); }
    if (open) {
      document.addEventListener("mousedown", handle);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        onClick={() => {
          if (disabled) return;
          if (!open && !closing && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, left: r.left });
          }
          if (open) { close(); } else { setClosing(false); setOpen(true); }
        }}
        disabled={disabled}
        variant="ghost"
        size="sm"
      >
        🕐 Snooze
      </Button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        // See RowSnoozeMenu above for why the positioning transform and the
        // animation class MUST live on different elements.
        <div
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            transform: "translateY(-100%)",
            zIndex: 9999,
          }}
        >
          <div
            data-theme={theme}
            className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
            onAnimationEnd={() => { if (closing) setClosing(false); }}
            style={{
              background: "var(--agent-surface-elevated)", borderRadius: 12, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--agent-border-default)", minWidth: 110,
            }}
          >
            {SNOOZE_OPTIONS.map((opt) => (
              <button key={opt.hours} onClick={() => { onSnoozeAll(logIds, taskIds, opt.hours); close(); }} className="w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors">{opt.label}</button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Priority stack — one flat, worst-first list of all active reminders (no
// Seller/Buyer columns; side rides on a per-row tag instead). Presentation
// only: every handler, optimistic overlay and the ChaseDrawer are the same as
// before. Each row carries its own coloured Chase (composer for that task);
// a Chase-all stays at the foot. Logic (buckets, cadence, escalation) is
// unchanged — see RemindersSection.
function PriorityList({
  logs,
  transactionId,
  propertyAddress,
  contacts,
  loading,
  handleComplete,
  handleSnooze,
  handleSnoozeAll,
  handleChased,
  optimisticNextDuePerLog,
}: {
  logs: ReminderLog[];
  transactionId: string;
  propertyAddress: string;
  contacts: Contact[];
  loading: string | null;
  handleComplete: (logId: string, taskId: string) => void;
  handleSnooze: (logId: string, taskId: string, hours: number) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  handleChased: (taskId: string, logId?: string) => void;
  optimisticNextDuePerLog?: Map<string, Date>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowsRef] = useAutoAnimate<HTMLDivElement>();
  const pathname = usePathname();
  // "Chase now" drawer for reminders that don't have a task yet (start-early
  // path). Holds the freshly-created ChaseTask id returned by the server so
  // the same ChaseDrawer component can render it as a single-log chase.
  const [earlyChase, setEarlyChase] = useState<{ logId: string; taskId: string; name: string; chaseCount: number } | null>(null);
  const [earlyChaseLoading, setEarlyChaseLoading] = useState<string | null>(null);
  // Per-row chase composer — the coloured Chase on a single row opens the
  // same ChaseDrawer for just that task.
  const [rowChase, setRowChase] = useState<{ logId: string; taskId: string; name: string; chaseCount: number; contacts: Contact[] } | null>(null);
  // Optimistic chase-count overlay per task. Click the ↻ Chased button →
  // counter bumps in the UI immediately; the server action runs in
  // background. When the props refresh (server data lands), the prop
  // chaseCount is >= our optimistic value so the overlay falls back.
  const [optimisticChases, setOptimisticChases] = useState<Record<string, number>>({});
  function optimisticChase(taskId: string, logId: string, baseCount: number) {
    setOptimisticChases((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? baseCount) + 1 }));
    handleChased(taskId, logId);
  }
  // Contacts to preselect when chasing — filtered to the row's own side,
  // falling back to all if that side has none (same rule the columns used).
  function contactsForSide(isBuyer: boolean): Contact[] {
    const filtered = contacts.filter((c) =>
      isBuyer ? ["purchaser", "broker", "solicitor"].includes(c.roleType) : ["vendor", "solicitor"].includes(c.roleType),
    );
    return filtered.length > 0 ? filtered : contacts;
  }

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

  return (
    <Card glassId="reminders-group" glassLabel="Reminders · Active" glassDefault="v05" padding="none">
      {/* Rows — one flat worst-first list, side shown per row */}
      <div ref={rowsRef} style={{ padding: "6px 0" }}>
        {logs.map((log, i) => {
          const task = log.chaseTasks.find((t) => t.status === "pending");
          const name = stripChase(log.reminderRule.name);
          const isBuyer = !!log.reminderRule.targetMilestoneCode?.startsWith("PM");
          // Optimistic override — chased rows show the new next-due-date
          // immediately (the prop's nextDueDate updates after the server
          // confirms a few seconds later).
          const effectiveNextDue = optimisticNextDuePerLog?.get(log.id) ?? log.nextDueDate;
          const dueDate = new Date(effectiveNextDue); dueDate.setHours(0, 0, 0, 0);
          const isOverdue = dueDate < today;
          const isDueToday = dueDate.getTime() === today.getTime();
          const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
          // Once chased, suppress the red Overdue / amber Due-today colors —
          // the row stays muted in Coming Up until the server escalates.
          const hasBeenChased = (task?.chaseCount ?? 0) >= 1;
          const urgencyColor = task?.priority === "escalated" ? "#dc2626"
            : hasBeenChased ? "var(--agent-text-muted)"
            : isOverdue ? "#ea580c"
            : isDueToday ? "#d97706"
            : "var(--agent-text-muted)";
          const urgencyLabel = task?.priority === "escalated" ? "Escalated"
            : hasBeenChased && isOverdue ? `Was due ${formatDate(effectiveNextDue)}`
            : hasBeenChased ? `Next ${formatDate(effectiveNextDue)}`
            : isOverdue ? `${daysOverdue}d overdue`
            : isDueToday ? "Due today"
            : task ? `Next ${formatDate(log.nextDueDate)}`
            : `From ${formatDate(log.nextDueDate)}`;
          const chipBg = task?.priority === "escalated" ? "rgba(220,38,38,0.14)"
            : hasBeenChased ? "rgba(148,163,184,0.14)"
            : isOverdue ? "rgba(234,88,12,0.14)"
            : isDueToday ? "rgba(217,119,6,0.14)"
            : "rgba(148,163,184,0.14)";

          return (
            <div
              key={log.id}
              style={{ padding: "7px 12px", borderTop: i > 0 ? "0.5px solid var(--agent-border-default)" : undefined, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, color: urgencyColor, background: chipBg, whiteSpace: "nowrap" }}>{urgencyLabel}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: isBuyer ? "#3b82f6" : "#ea580c" }}>
                    <RoleIcon role={isBuyer ? "purchaser" : "vendor"} size={11} />{isBuyer ? "Buyer" : "Seller"}
                  </span>
                </div>
                <p className="reminders-title" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{name}</p>
                {(() => {
                  // Optimistic overlay tracks the human ("you") count; auto is
                  // the remainder of the total. Keeps the two visible so an
                  // autopilot-only row never reads as agent-chased.
                  const manualChases = task ? Math.max(optimisticChases[task.id] ?? 0, task.manualChaseCount) : 0;
                  const autoChases = task ? Math.max(0, task.chaseCount - task.manualChaseCount) : 0;
                  const chaseBadge = chaseBadgeLabel(autoChases, manualChases);
                  return chaseBadge ? (
                    <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 500, color: "var(--agent-text-muted)" }}>{chaseBadge}</p>
                  ) : null;
                })()}
                {task?.fallbackKind && (
                  <Pill
                    glass
                    tone="warning"
                    size="sm"
                    style={{ marginTop: 3 }}
                    title={fallbackChipTitle(task.fallbackKind)}
                  >
                    {fallbackChipText(task.fallbackKind)}
                  </Pill>
                )}
              </div>
              {task && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <Button
                    size="sm"
                    onClick={() => setRowChase({ logId: log.id, taskId: task.id, name, chaseCount: task.chaseCount, contacts: contactsForSide(isBuyer) })}
                    style={{ height: 28 }}
                  >
                    Chase
                  </Button>
                  <button
                    onClick={() => optimisticChase(task.id, log.id, task.manualChaseCount)}
                    title="Mark as chased. Advances the next chase date without sending an email"
                    style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", height: 28, padding: "0 9px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}
                  >
                    ↻ Chased
                  </button>
                  <button
                    onClick={() => handleComplete(log.id, task.id)}
                    disabled={loading === task.id}
                    title="Confirm milestone done"
                    style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", height: 28, padding: "0 9px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}
                  >
                    ✓ Done
                  </button>
                  <RowSnoozeMenu logId={log.id} taskId={task.id} onSnooze={handleSnooze} />
                </div>
              )}
              {!task && log.status === "active" && (
                <button
                  onClick={async () => {
                    if (earlyChaseLoading) return;
                    setEarlyChaseLoading(log.id);
                    try {
                      const { taskId } = await chaseNowFromLogAction(log.id, pathname);
                      setEarlyChase({ logId: log.id, taskId, name: stripChase(log.reminderRule.name), chaseCount: 0 });
                    } catch (err) {
                      console.error("[RemindersSection] chaseNowFromLog failed", err);
                    } finally {
                      setEarlyChaseLoading(null);
                    }
                  }}
                  disabled={earlyChaseLoading === log.id}
                  title="Chase this client now, before its scheduled start date"
                  style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", cursor: earlyChaseLoading === log.id ? "wait" : "pointer", flexShrink: 0, whiteSpace: "nowrap", opacity: earlyChaseLoading === log.id ? 0.5 : 1 }}
                >
                  {earlyChaseLoading === log.id ? "…" : "→ Chase now"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Chase + Snooze all */}
      {openTasks.length > 0 && (
        <div style={{ padding: "8px 12px", borderTop: "0.5px solid rgba(15,23,42,0.06)", display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          <Button
            onClick={() => setDrawerOpen(true)}
            size="sm"
          >
            {milestones.length === 1 ? "Chase" : `Chase all (${milestones.length})`}
          </Button>
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
          contacts={contacts}
          milestones={milestones.length > 1 ? milestones : undefined}
          onClose={() => setDrawerOpen(false)}
          onSent={() => {
            // Bulk chase via drawer — pass log IDs too so all rows hide.
            openTasks.forEach(({ log, task }) => handleChased(task.id, log.id));
            setDrawerOpen(false);
          }}
        />
      )}

      {/* Per-row chase — same composer, scoped to the one task. */}
      {rowChase && (
        <ChaseDrawer
          chaseTaskId={rowChase.taskId}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
          milestoneName={rowChase.name}
          chaseCount={rowChase.chaseCount}
          contacts={rowChase.contacts}
          onClose={() => setRowChase(null)}
          onSent={() => {
            handleChased(rowChase.taskId, rowChase.logId);
            setRowChase(null);
          }}
        />
      )}

      {earlyChase && (
        <ChaseDrawer
          chaseTaskId={earlyChase.taskId}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
          milestoneName={earlyChase.name}
          chaseCount={earlyChase.chaseCount}
          contacts={contacts}
          onClose={() => setEarlyChase(null)}
          onSent={() => {
            handleChased(earlyChase.taskId, earlyChase.logId);
            setEarlyChase(null);
          }}
        />
      )}
    </Card>
  );
}

export function RemindersSection({
  transactionId,
  reminderLogs,
  contacts = [],
  propertyAddress = "",
  automatedEmails,
  transactionStatus,
}: Props) {
  const pathname = usePathname();
  const updateTabBadge = useTabBadge();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  // Optimistic hide: rows are dropped from the rendered list immediately on
  // action, without waiting for revalidatePath to round-trip. auto-animate
  // (attached to the list containers below) handles the fade-out + sibling
  // reflow. Reset whenever fresh server data arrives.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Optimistic snooze → milestone code suppression. When a row is hidden
  // by snooze, we also stash the row's target milestone code here so the
  // AutomatedEmailsCard can locally filter its Upcoming list — the
  // matching upcoming-chase entry vanishes the instant the snooze fires
  // instead of sitting there during the server roundtrip.
  const [optimisticallySnoozedCodes, setOptimisticallySnoozedCodes] = useState<Set<string>>(new Set());
  // Optimistic wakeup: log IDs the user has just woken up. Overrides the
  // snoozedUntil check in the active-logs filter so the row appears in
  // the appropriate active bucket immediately (instead of staying in the
  // snoozed group during the server roundtrip).
  const [wokenUpIds, setWokenUpIds] = useState<Set<string>>(new Set());
  // Optimistic destination-bucket placement so a row APPEARS where it's
  // going immediately, not just disappears from its current bucket:
  //   - optimisticSnoozedUntil: snooze action → row goes to Snoozed
  //   - optimisticNextDueDate:  chase action  → row goes to Coming Up
  const [optimisticSnoozedUntil, setOptimisticSnoozedUntil] = useState<Map<string, Date>>(new Map());
  const [optimisticNextDueDate, setOptimisticNextDueDate] = useState<Map<string, Date>>(new Map());
  useEffect(() => {
    setHiddenIds(new Set());
    setOptimisticallySnoozedCodes(new Set());
    setWokenUpIds(new Set());
    setOptimisticSnoozedUntil(new Map());
    setOptimisticNextDueDate(new Map());
  }, [reminderLogs]);
  const [snoozedListRef] = useAutoAnimate<HTMLDivElement>();
  const [completedListRef] = useAutoAnimate<HTMLDivElement>();
  const [groupsRef] = useAutoAnimate<HTMLDivElement>();
  // Wraps the whole reminder-list block (urgency groups + Snoozed +
  // Completed) so when a section appears/disappears (e.g. Snoozed becomes
  // non-empty for the first time) the siblings animate smoothly.
  const [allSectionsRef] = useAutoAnimate<HTMLDivElement>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    escalated: false,
    overdue: false,
    due_today: false,
    upcoming: true,
    snoozed: true,
    completed: true,
  });

  const now = new Date();

  // Effective snooze state = optimistic override OR real prop value.
  // The optimistic value wins because the user just clicked snooze and
  // we want them to see the row in Snoozed before the server confirms.
  function effectiveSnoozedUntil(l: ReminderLog): Date | null {
    const opt = optimisticSnoozedUntil.get(l.id);
    if (opt) return opt;
    if (l.snoozedUntil) return new Date(l.snoozedUntil);
    return null;
  }
  function isCurrentlySnoozed(l: ReminderLog): boolean {
    if (wokenUpIds.has(l.id)) return false;
    const until = effectiveSnoozedUntil(l);
    return until !== null && until > now;
  }

  const activeLogs = reminderLogs.filter((l) =>
    !hiddenIds.has(l.id) && l.status === "active" && !isCurrentlySnoozed(l)
  );
  const snoozedLogs = reminderLogs.filter(
    (l) => !hiddenIds.has(l.id) && l.status === "active" && isCurrentlySnoozed(l)
  );
  const completedLogs = reminderLogs.filter(
    (l) => !hiddenIds.has(l.id) && (l.status === "completed" || l.status === "inactive")
  );

  // Bucket every active log first — same call we'd use for the tab badge
  // count, ensuring the visible count and the bucket placements agree.
  const grouped: Record<UrgencyGroup, ReminderLog[]> = { escalated: [], overdue: [], due_today: [], upcoming: [] };
  for (const log of activeLogs) {
    grouped[classifyActive(log, now, optimisticNextDueDate.get(log.id) ?? null)].push(log);
  }

  // Push the live tab badge count so the "Reminders" tab pill updates the
  // instant a row is snoozed / completed (via optimistic hiddenIds) — no
  // wait for the revalidation roundtrip. Count = rows landing in any of
  // the actionable buckets (escalated + overdue + due_today). Stays in
  // lock-step with what's visible above.
  const activeCount = grouped.escalated.length + grouped.overdue.length + grouped.due_today.length;
  useEffect(() => {
    if (updateTabBadge) updateTabBadge("reminders", activeCount);
  }, [activeCount, updateTabBadge]);

  // Flat priority stack: worst bucket first (escalated → overdue → due today →
  // upcoming), and within a bucket the nearest due date first. Same buckets as
  // the badge count, just concatenated into one list for the single-column UI.
  const byDue = (a: ReminderLog, b: ReminderLog) =>
    new Date(optimisticNextDueDate.get(a.id) ?? a.nextDueDate).getTime() -
    new Date(optimisticNextDueDate.get(b.id) ?? b.nextDueDate).getTime();
  const activeSorted = [
    ...grouped.escalated.slice().sort(byDue),
    ...grouped.overdue.slice().sort(byDue),
    ...grouped.due_today.slice().sort(byDue),
    ...grouped.upcoming.slice().sort(byDue),
  ];

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
      try {
        const result = await completeTaskAction(taskId, pathname);
        if ("blocked" in result && result.blocked) {
          // Server refused to confirm the milestone because an earlier
          // one in the chain isn't done yet. Un-hide the row and toast
          // the reason so the agent knows what to action.
          setHiddenIds((prev) => { const next = new Set(prev); next.delete(logId); return next; });
          const names = result.missing.map((m) => m.name);
          const msg = names.length === 1
            ? `Can't confirm yet. "${names[0]}" needs to be confirmed first.`
            : `Can't confirm yet. These earlier milestones need confirming first: ${names.join(", ")}.`;
          toast.error(msg);
        } else {
          toast.success("Marked done");
        }
      } finally { setLoading(null); }
    });
  }

  function handleSnooze(logId: string, taskId: string, hours: number) {
    // Skip if this task is already being snoozed (prevents the 5x-click
    // misfire when a user clicks the menu option in rapid succession).
    if (loading === taskId) return;
    // Optimistic: place the row in the Snoozed section immediately.
    // No need to hide via hiddenIds — the snoozed filter will pick it up
    // via optimisticSnoozedUntil and the active filter will exclude it.
    const wakeUp = new Date(Date.now() + hours * 60 * 60 * 1000);
    setOptimisticSnoozedUntil((prev) => new Map(prev).set(logId, wakeUp));
    // Stash the milestone code so the auto-emails preview can suppress
    // matching upcoming chases instantly.
    const log = reminderLogs.find((l) => l.id === logId);
    const code = log?.reminderRule.targetMilestoneCode;
    if (code) setOptimisticallySnoozedCodes((prev) => new Set([...prev, code]));
    setLoading(taskId);
    toast.success(snoozeToastLabel(hours));
    startTransition(async () => {
      try { await snoozeTaskAction(taskId, hours, pathname); }
      finally { setLoading(null); }
    });
  }

  function handleSnoozeAll(logIds: string[], taskIds: string[], hours: number) {
    if (taskIds.length === 0) return;
    const wakeUp = new Date(Date.now() + hours * 60 * 60 * 1000);
    setOptimisticSnoozedUntil((prev) => {
      const next = new Map(prev);
      for (const id of logIds) next.set(id, wakeUp);
      return next;
    });
    const codes = logIds
      .map((id) => reminderLogs.find((l) => l.id === id)?.reminderRule.targetMilestoneCode)
      .filter((c): c is string => !!c);
    if (codes.length > 0) {
      setOptimisticallySnoozedCodes((prev) => new Set([...prev, ...codes]));
    }
    setLoading(taskIds[0] ?? "");
    toast.success(`${taskIds.length} ${taskIds.length === 1 ? "reminder" : "reminders"} ${snoozeToastLabel(hours).toLowerCase()}`);
    startTransition(async () => {
      try { await Promise.all(taskIds.map((id) => snoozeTaskAction(id, hours, pathname))); }
      finally { setLoading(null); }
    });
  }

  function handleWakeup(logId: string) {
    // Optimistic: mark woken up so the row leaves snoozed and appears in
    // the right active bucket immediately. Don't add to hiddenIds —
    // hiddenIds removes from ALL groups (including the active bucket
    // where the row should now appear).
    setWokenUpIds((prev) => new Set([...prev, logId]));
    setLoading(logId);
    startTransition(async () => {
      try { await wakeupReminderAction(logId, pathname); }
      finally { setLoading(null); }
    });
  }

  function handleChased(taskId: string, logId?: string) {
    // Optimistic placement: the row moves to Coming Up immediately by
    // setting an optimistic nextDueDate (now + repeatEveryDays). The
    // classifyActive helper picks this up and the row appears in the
    // upcoming bucket in the same frame.
    if (logId) {
      const log = reminderLogs.find((l) => l.id === logId);
      const repeat = log?.reminderRule.repeatEveryDays ?? 5;
      const newDue = new Date(Date.now() + repeat * 86400000);
      setOptimisticNextDueDate((prev) => new Map(prev).set(logId, newDue));
      // Auto-expand Coming Up so the user sees the row land there
      // (the section is collapsed by default).
      setCollapsed((prev) => ({ ...prev, upcoming: false }));
      toast.success(`Chased, next in ${repeat} ${repeat === 1 ? "day" : "days"}`);
    }
    act(taskId, () => advanceChaseTaskAction(taskId, pathname));
  }

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
            <Pill glass tone="danger" size="md">{escalatedCount} escalated</Pill>
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
        <AutomatedEmailsCard
          data={automatedEmails}
          transactionId={transactionId}
          optimisticallySnoozedCodes={optimisticallySnoozedCodes}
          fileOnHold={transactionStatus === "on_hold"}
        />
      )}

      {/* Empty state */}
      {activeLogs.length === 0 && snoozedLogs.length === 0 && completedLogs.length === 0 && (
        <Card padding="none" className="px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40">No active reminders</p>
          <p className="text-xs text-slate-900/30 mt-1">Reminders are set up — they&apos;ll appear here as they come due.</p>
        </Card>
      )}

      {/* All reminder sections wrapped together so when Snoozed or
        * Completed appear/disappear (e.g. first snooze adds the Snoozed
        * card) the siblings shift smoothly instead of pop-in. */}
      <div ref={allSectionsRef} className="space-y-3">
      {/* Active reminders — one flat priority stack (worst first), side per row. */}
      <div ref={groupsRef} className="space-y-3">
        {activeSorted.length > 0 && (
          <PriorityList
            logs={activeSorted}
            transactionId={transactionId}
            propertyAddress={propertyAddress}
            contacts={contacts}
            loading={loading}
            handleComplete={handleComplete}
            handleSnooze={handleSnooze}
            handleSnoozeAll={handleSnoozeAll}
            handleChased={handleChased}
            optimisticNextDuePerLog={optimisticNextDueDate}
          />
        )}
      </div>

      {/* Snoozed */}
      {snoozedLogs.length > 0 && (
        <Card glassId="reminders-snoozed" glassLabel="Reminders · Snoozed" glassDefault="v05" padding="none">
          <div
            className="agent-acc-hdr"
            style={{ borderBottom: "none" }}
            role="button"
            tabIndex={0}
            aria-expanded={!collapsed.snoozed}
            onClick={() => toggleCollapse("snoozed")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse("snoozed"); } }}
          >
            <div className="flex items-center gap-2">
              <span className="agent-acc-title text-purple-700">Snoozed</span>
              <span className="agent-badge">{snoozedLogs.length}</span>
            </div>
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              style={{
                flexShrink: 0,
                color: "var(--agent-text-muted)",
                transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: collapsed.snoozed ? "rotate(0deg)" : "rotate(180deg)",
              }}
            />
          </div>
          <div className={`agent-acc ${!collapsed.snoozed ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div ref={snoozedListRef} className="space-y-1.5 p-4">
                {snoozedLogs.map((log) => {
                  // Optimistic override — when the user just snoozed, show
                  // the locally-chosen wake-up time instead of the (stale)
                  // server value.
                  const displaySnoozedUntil = optimisticSnoozedUntil.get(log.id) ?? log.snoozedUntil;
                  return (
                  <div key={log.id} className="glass-subtle rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900/80 truncate">
                        {stripChase(log.reminderRule.name)}
                      </p>
                      {displaySnoozedUntil && (
                        <p className="text-xs text-slate-900/40 mt-0.5">
                          Wakes {new Date(displaySnoozedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Completed */}
      {completedLogs.length > 0 && (
        <Card glassId="reminders-completed" glassLabel="Reminders · Completed" glassDefault="v05" padding="none">
          <div
            className="agent-acc-hdr"
            style={{ borderBottom: "none" }}
            role="button"
            tabIndex={0}
            aria-expanded={!collapsed.completed}
            onClick={() => toggleCollapse("completed")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse("completed"); } }}
          >
            <div className="flex items-center gap-2">
              <span className="agent-acc-title text-slate-900/50">Completed</span>
              <span className="agent-badge">{completedLogs.length}</span>
            </div>
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              style={{
                flexShrink: 0,
                color: "var(--agent-text-muted)",
                transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: collapsed.completed ? "rotate(0deg)" : "rotate(180deg)",
              }}
            />
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
        </Card>
      )}
      </div>
    </section>
  );
}
