"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaretDown, CheckCircle, Clock } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { GlassCard } from "@/components/glass/GlassCard";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { toUKDateStr, formatDate } from "@/lib/utils";
import { classifyReminder } from "@/lib/reminders/classify";
import { completeTaskAction, snoozeTaskAction, wakeupReminderAction, escalateTaskAction, runReminderEngineAction, recordManualChaseAction, advanceChaseTaskAction } from "@/app/actions/tasks";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { Button } from "@/components/ui/Button";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UrgencyPill, SidePill, BlocksExchangePill, ManualPill, type UrgencyBucket } from "@/components/reminders/status-pills";
import { AutoChaseCountdown } from "@/components/reminders/AutoChaseCountdown";
import type { AutopilotStatus } from "@/lib/services/reminder-autopilot";
import type { getAgentReminderLogs } from "@/lib/services/reminders";
import { withSolicitorRecipients, whoToChase, joinNames, type SolicitorRef, type ChaseContact } from "@/lib/services/chase-recipients";
import { renderChaseCardCopy } from "@/lib/chase/chase-card-copy";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];
type MilestoneInfo = Record<string, { outstanding: string; responsible: "client" | "solicitor" | null }>;
type AutopilotMap = Map<string, AutopilotStatus>;
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";
type LastComm = { createdAt: Date; method: string | null };

// E1 semantic colour-coding (intentional, not canonical class — see ANIMATION_STANDARDS §E1).
// Header backgrounds now use wq-urgency-bar-* classes (defined in globals.css) so they
// transition between glass mode (slightly transparent pale tint) and solid mode (fully
// solid pale tint) — matching the glass↔solid behaviour of FileAlertsStrip + filter bar.
// Colour identity unchanged per E1; the transition is added on top.
const GROUP_CONFIG: Record<UrgencyGroup, { label: string; headerCls: string; labelCls: string; badgeCls: string }> = {
  escalated: { label: "Escalated",  headerCls: "wq-urgency-bar wq-urgency-bar-escalated", labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700"       },
  overdue:   { label: "Overdue",    headerCls: "wq-urgency-bar wq-urgency-bar-overdue",   labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700" },
  due_today: { label: "Due today",  headerCls: "wq-urgency-bar wq-urgency-bar-due-today", labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700"   },
  upcoming:  { label: "Coming up",  headerCls: "wq-urgency-bar wq-urgency-bar-coming-up", labelCls: "text-slate-900/60", badgeCls: "bg-slate-100 text-slate-900/60" },
};

// Urgency, side and fallback chips now live in components/reminders/status-pills.tsx
// (shared with the property-file Reminders tab).

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

function classifyActive(log: AgentReminderLog, now: Date, upcomingCutoffStr: string): UrgencyGroup | null {
  // Defer to the canonical classifier (lib/reminders/classify.ts) for the
  // overdue / due_today / escalated / upcoming decision. The work queue
  // then additionally filters "upcoming" by a 3-business-day window so
  // far-future reminders don't crowd the list.
  const bucket = classifyReminder(log, now);
  if (bucket === "escalated") return "escalated";
  if (bucket === "overdue") return "overdue";
  if (bucket === "due_today") return "due_today";
  if (bucket === "upcoming") {
    const dueStr = toUKDateStr(log.nextDueDate);
    if (dueStr <= upcomingCutoffStr) return "upcoming";
  }
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
  escalated: "var(--agent-danger)",
  overdue:   "#ea580c",
  due_today: "var(--agent-warning)",
  upcoming:  "var(--agent-border-subtle)",
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
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }

  // Listener gated on `open` — see ChaseDrawer for the same pattern. If
  // registered unconditionally on mount, any prior click anywhere on the
  // page calls close() and flips `closing` to true, which then permanently
  // blocks `setPos` inside onClick (its `!open && !closing` guard) and the
  // menu never renders even when reopened.
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
          if (!open && !closing && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, left: r.left });
          }
          if (open) { close(); } else { setClosing(false); setOpen(true); }
        }}
        disabled={disabled}
        variant="ghost"
        size="sm"
        style={{ whiteSpace: "nowrap" }}
      >
        <Clock size={12} weight="regular" /> Snooze all
      </Button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        // Outer wrapper: positioning transform (translateY(-100%) anchors
        // bottom edge above trigger). Inner box: slide-in animation. They
        // must be split or the animation transform overrides positioning
        // and the menu lands ON the button instead of above it.
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
                  close();
                }}
                className="agent-dropdown-item"
              >
                {opt.label}
              </button>
            ))}
          </div>
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
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }

  // See SideSnoozeMenu above for why the listener is gated on `open`.
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
          if (!open && !closing && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ top: r.top - 4, right: window.innerWidth - r.right });
          }
          if (open) { close(); } else { setClosing(false); setOpen(true); }
        }}
        title="Snooze"
        variant="secondary"
        size="sm"
        style={{ flexShrink: 0 }}
      >
        <Clock size={12} weight="regular" />
      </Button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        // See SideSnoozeMenu above for why the positioning transform and the
        // animation class MUST live on different elements.
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
                  close();
                }}
                className="agent-dropdown-item"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Friendly label for a comm method on the chase-history line.
function methodLabel(m: string | null): string | null {
  if (!m) return null;
  const map: Record<string, string> = { email: "email", whatsapp: "WhatsApp", call: "phone", sms: "text", letter: "letter", portal: "the portal" };
  return map[m] ?? m;
}

// Split a UK address into "first line" + "town/postcode" (last two comma parts),
// mirroring the transactions list. Kept inline to match the grandfathered pattern.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

// One card per property: photo + address header, then a single flat worst-first
// list of that property's reminders (side shown as a per-row pill, not a column).
// Matches the property-file Reminders tab (RemindersSection / PriorityList).
function SplitFileCard({
  txId,
  address,
  photoUrl,
  milestoneInfo,
  autopilot,
  logs,
  groupKey,
  loading,
  exitingIds,
  handleComplete,
  handleSnooze,
  handleSnoozeAll,
  handleChased,
  hideChase,
}: {
  txId: string;
  address: string;
  photoUrl?: string | null;
  milestoneInfo?: MilestoneInfo;
  autopilot?: AutopilotMap;
  logs: AgentReminderLog[];
  groupKey: UrgencyGroup;
  loading: string | null;
  exitingIds: Set<string>;
  handleComplete: (taskId: string) => void;
  handleSnooze: (taskId: string, hours: number) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], hours: number) => void;
  handleChased: (taskId: string, logId?: string) => void;
  hideChase?: boolean;
}) {
  const leftBorder = GROUP_LEFT_BORDER[groupKey];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowChase, setRowChase] = useState<{ taskId: string; name: string; chaseCount: number; isBuyer: boolean; contacts: ChaseContact[] } | null>(null);
  const [optimisticChases, setOptimisticChases] = useState<Record<string, number>>({});
  function optimisticChase(taskId: string, logId: string, baseCount: number) {
    setOptimisticChases((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? baseCount) + 1 }));
    handleChased(taskId, logId);
  }

  const { line, location } = splitAddress(address);
  const contacts = logs[0]?.transaction.contacts ?? [];
  // The file's solicitors (from the vendor/purchaser solicitor FK columns) so the
  // chase drawer can offer the right-side solicitor as a recipient.
  const tx0 = logs[0]?.transaction;
  const vendorSolicitor: SolicitorRef | null = tx0?.vendorSolicitorContact
    ? { ...tx0.vendorSolicitorContact, firm: tx0.vendorSolicitorFirm ?? null }
    : null;
  const purchaserSolicitor: SolicitorRef | null = tx0?.purchaserSolicitorContact
    ? { ...tx0.purchaserSolicitorContact, firm: tx0.purchaserSolicitorFirm ?? null }
    : null;
  function contactsForSide(isBuyer: boolean): ChaseContact[] {
    const filtered = contacts.filter((c) =>
      isBuyer ? ["purchaser", "broker", "solicitor"].includes(c.roleType) : ["vendor", "solicitor"].includes(c.roleType),
    );
    return withSolicitorRecipients(filtered.length > 0 ? filtered : contacts, {
      vendorSolicitor, purchaserSolicitor, side: isBuyer ? "purchaser" : "vendor",
    });
  }
  const allRecipients = withSolicitorRecipients(contacts, { vendorSolicitor, purchaserSolicitor, side: null });

  const isBuyerLog = (l: AgentReminderLog) => !!l.reminderRule.targetMilestoneCode?.startsWith("PM");

  const openTasks = logs
    .flatMap((log) => { const task = log.chaseTasks.find((t) => t.status === "pending"); return task ? [{ log, task }] : []; })
    .sort((a, b) => new Date(a.log.nextDueDate).getTime() - new Date(b.log.nextDueDate).getTime());
  const scheduledLogs = logs.filter((log) => !log.chaseTasks.find((t) => t.status === "pending"));

  const milestones = openTasks.map(({ log, task }) => ({
    chaseTaskId: task.id,
    name: log.reminderRule.name.replace(/^Chase:\s*/i, ""),
    chaseCount: task.chaseCount,
  }));
  const maxChaseCount = milestones.length > 0 ? Math.max(...milestones.map((m) => m.chaseCount)) : 0;
  const allTaskIds = openTasks.map(({ task }) => task.id);
  const allLogIds  = openTasks.map(({ log })  => log.id);
  // Single open task on this file+group → side-scope the footer chase like the file tab.
  const soleOpen = openTasks.length === 1 ? openTasks[0] : null;
  const soleIsBuyer = soleOpen ? isBuyerLog(soleOpen.log) : false;

  return (
    // Design Lab: `reminders-file-card`. Default v05 per Ellis's pick, 2026-08-09.
    <GlassCard
      glassId="reminders-file-card"
      label="Reminders · File card"
      defaultVariant="v05"
      style={{ borderRadius: 20, borderLeft: `4px solid ${leftBorder}` }}
    >
      {/* Property header — photo + address (first line bold, town/postcode under),
          and the whole-file actions on the right. */}
      <div className="agent-card-hdr" style={{
        background: "var(--agent-card-header-veil)",
        padding: "10px 16px",
        borderRadius: "16px 20px 0 0",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <PropertyThumb photoUrl={photoUrl} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Only line 1 is the link (inline-flex); the town/postcode sits below it. */}
          <Link href={`/agent/transactions/${txId}`} className="agent-link" style={{ textDecoration: "none", maxWidth: "100%" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {line}
            </span>
            <LinkArrow />
          </Link>
          {location && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>
          )}
        </div>
        {/* Whole-file actions + count. Chase all / Snooze all live here (top) rather
            than a footer under the rows. A single reminder is covered by its own row,
            so the file-level actions only appear when there are 2+ to act on at once. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
          {!hideChase && openTasks.length >= 2 && (
            <>
              <Button size="sm" onClick={() => setDrawerOpen(true)}>Chase all ({milestones.length})</Button>
              <SideSnoozeMenu logIds={allLogIds} taskIds={allTaskIds} onSnoozeAll={handleSnoozeAll} disabled={loading !== null} />
            </>
          )}
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
            {logs.length} {logs.length === 1 ? "reminder" : "reminders"}
          </span>
        </div>
      </div>

      {/* Flat rows — worst-first, side as a per-row pill. */}
      <div style={{ padding: "6px 0" }}>
        {openTasks.map(({ log, task }, i) => {
          // Prefer the full-sentence milestone name ("Seller has received the
          // memorandum of sale") over the terse reminder name ("Seller MOS received").
          const name = log.reminderRule.anchorMilestone?.name ?? log.reminderRule.name.replace(/^Chase:\s*/i, "");
          const isBuyer = isBuyerLog(log);
          const rowTodayStr = toUKDateStr(new Date());
          const dueStr = toUKDateStr(log.nextDueDate);
          const isOverdue = dueStr < rowTodayStr;
          const isDueToday = dueStr === rowTodayStr;
          const daysOverdue = isOverdue ? Math.floor((new Date(rowTodayStr).getTime() - new Date(dueStr).getTime()) / 86400000) : 0;
          const hasBeenChased = (task.chaseCount ?? 0) >= 1;
          const bucket: UrgencyBucket = task.priority === "escalated" ? "escalated"
            : isOverdue ? "overdue"
            : isDueToday ? "due_today"
            : "upcoming";
          const urgencyLabel = task.priority === "escalated" ? "Escalated"
            : hasBeenChased && isOverdue ? `Was due ${formatDate(log.nextDueDate)}`
            : hasBeenChased ? `Next ${formatDate(log.nextDueDate)}`
            : isOverdue ? `${daysOverdue}d overdue`
            : isDueToday ? "Due today"
            : `Next ${formatDate(log.nextDueDate)}`;
          const manualChases = Math.max(optimisticChases[task.id] ?? 0, task.manualChaseCount);
          const autoChases = Math.max(0, task.chaseCount - task.manualChaseCount);
          const escalationLine = task.priority === "escalated"
            ? (task.escalationReason || task.escalatedAt)
              ? `Escalated${task.escalatedBy?.name ? ` by ${task.escalatedBy.name}` : ""}${task.escalatedAt ? ` on ${formatDate(task.escalatedAt)}` : ""}${task.escalationReason ? ` · ${task.escalationReason}` : ""}`
              : "Auto-escalated, no response after repeated chases"
            : undefined;

          // Enrichment (free tier) — who owes it, what it means, chase history.
          const code = log.reminderRule.targetMilestoneCode;
          const info = code ? milestoneInfo?.[code] : undefined;
          const who = whoToChase({
            side: isBuyer ? "purchaser" : "vendor",
            responsible: info?.responsible ?? null,
            contacts,
            vendorSolicitor,
            purchaserSolicitor,
          });
          // Fill the {Client Names} / {Solicitor Firm} tokens for this file+side.
          // Fall back to the generic party wording when nothing is named yet.
          const clientRole = isBuyer ? "purchaser" : "vendor";
          const clientList = contacts.filter((c) => c.roleType === clientRole).map((c) => c.name);
          const clientNames = clientList.length > 0 ? joinNames(clientList) : (isBuyer ? "the buyer" : "the seller");
          const sideSol = isBuyer ? purchaserSolicitor : vendorSolicitor;
          const solicitorFirm = sideSol?.firm?.name || sideSol?.name || (isBuyer ? "the buyer's solicitor" : "the seller's solicitor");
          // Singular wording when there's zero or one named principal on the side
          // ("the seller" fallback reads singular too); plural for joint clients.
          const copy = renderChaseCardCopy(code, clientNames, solicitorFirm, clientList.length <= 1);
          const blocksExchange = !!log.reminderRule.anchorMilestone?.blocksExchange;
          const lastComm = task.communications[0];
          const chaseHistory = (() => {
            if (task.chaseCount === 0) return "Not chased yet · first nudge due";
            const bits = [`Chased ${task.chaseCount}×`];
            if (autoChases > 0 && manualChases > 0) bits.push(`${autoChases} auto, ${manualChases} by you`);
            else if (manualChases > 0) bits.push("by you");
            else bits.push("on autopilot");
            if (lastComm) {
              const d = Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / 86400000);
              const when = d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
              const ml = methodLabel(lastComm.method);
              bits.push(`last ${when}${ml ? ` by ${ml}` : ""}`);
            }
            return bits.join(" · ");
          })();

          const isExiting = exitingIds.has(log.id);
          return (
            <div
              key={log.id}
              className={isExiting ? "agent-row-exit" : (loading === task.id ? "agent-row-flash" : undefined)}
              style={{ padding: "10px 12px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", alignItems: "flex-start", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <UrgencyPill label={urgencyLabel} bucket={bucket} chased={hasBeenChased} />
                  <SidePill isBuyer={isBuyer} />
                  {blocksExchange && <BlocksExchangePill />}
                  {autopilot?.get(log.id)?.kind === "manual" && <ManualPill />}
                </div>
                {/* Desktop: fuller sentence-style step name (variables filled).
                    Mobile: the terse milestone name. Both in the DOM; CSS toggles. */}
                <p style={{ margin: 0, fontSize: 13, fontWeight: 660, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
                  <span className="rem-step-desktop">{copy?.step ?? name}</span>
                  <span className="rem-step-mobile">{name}</span>
                </p>
                {who && (
                  // Mobile-only: on desktop the step name + supporting sentence already
                  // name the party, so this quick who-scan is redundant there.
                  <p className="rem-chasing-line" style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                    Chasing <b style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>{who.name}</b>{who.role ? ` · the ${who.role}` : ""}
                  </p>
                )}
                {(copy?.line ?? info?.outstanding) && (
                  <p style={{ margin: "7px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderLeft: "2px solid var(--agent-border-default)", borderRadius: "0 8px 8px 0", padding: "6px 10px" }}>
                    {copy?.line ?? info?.outstanding}
                  </p>
                )}
                <p style={{ margin: "7px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>↻ {chaseHistory}</p>
                {escalationLine && (
                  <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>⚑ {escalationLine}</p>
                )}
                {(() => {
                  const st = autopilot?.get(log.id);
                  if (st?.kind === "auto") return <AutoChaseCountdown iso={st.nextSend} />;
                  if (st?.kind === "manual" && st.reason) return <p style={{ margin: "8px 0 0", fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}>{st.reason}</p>;
                  return null;
                })()}
              </div>
              {!hideChase && (
                <Button
                  size="sm"
                  onClick={() => setRowChase({ taskId: task.id, name, chaseCount: task.chaseCount, isBuyer, contacts: contactsForSide(isBuyer) })}
                  style={{ flexShrink: 0 }}
                >
                  Chase
                </Button>
              )}
              <button
                onClick={() => optimisticChase(task.id, log.id, task.manualChaseCount)}
                disabled={isExiting}
                title="Mark as chased. Advances the next chase date without sending an email"
                className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                ↻ Chased
              </button>
              <Button
                onClick={() => handleComplete(task.id)}
                disabled={loading === task.id || isExiting}
                title="Mark step done"
                variant="secondary"
                size="sm"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                <CheckCircle size={12} weight="fill" /> Done
              </Button>
              <RowSnoozeMenu taskId={task.id} onSnooze={handleSnooze} />
            </div>
          );
        })}
        {scheduledLogs.map((log, i) => {
          const name = log.reminderRule.anchorMilestone?.name ?? log.reminderRule.name.replace(/^Chase:\s*/i, "");
          const isBuyer = isBuyerLog(log);
          const dueDate = new Date(log.nextDueDate);
          const dueDateLabel = dueDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          return (
            <div
              key={log.id}
              style={{ padding: "7px 12px", borderTop: (i > 0 || openTasks.length > 0) ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <SidePill isBuyer={isBuyer} />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{name}</p>
                <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 500, color: "var(--agent-text-muted)" }}>Due {dueDateLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chase-all drawer */}
      {drawerOpen && (
        <ChaseDrawer
          chaseTaskId={milestones[0]?.chaseTaskId ?? ""}
          transactionId={txId}
          propertyAddress={address}
          milestoneName={milestones[0]?.name ?? ""}
          chaseCount={maxChaseCount}
          contacts={soleOpen ? contactsForSide(soleIsBuyer) : allRecipients}
          defaultAddRole={soleOpen ? (soleIsBuyer ? "purchaser" : "vendor") : undefined}
          milestones={milestones.length > 1 ? milestones : undefined}
          onClose={() => setDrawerOpen(false)}
          onSent={() => {
            openTasks.forEach(({ log, task }) => handleChased(task.id, log.id));
            setDrawerOpen(false);
          }}
        />
      )}

      {/* Per-row chase drawer */}
      {rowChase && (
        <ChaseDrawer
          chaseTaskId={rowChase.taskId}
          transactionId={txId}
          propertyAddress={address}
          milestoneName={rowChase.name}
          chaseCount={rowChase.chaseCount}
          contacts={rowChase.contacts}
          defaultAddRole={rowChase.isBuyer ? "purchaser" : "vendor"}
          onClose={() => setRowChase(null)}
          onSent={() => {
            const match = openTasks.find(({ task }) => task.id === rowChase.taskId);
            handleChased(rowChase.taskId, match?.log.id);
            setRowChase(null);
          }}
        />
      )}
    </GlassCard>
  );
}

export function AgentRemindersList({ logs, photoByTx, milestoneInfo, autopilot, hideChase }: { logs: AgentReminderLog[]; photoByTx?: Map<string, string | null>; milestoneInfo?: MilestoneInfo; autopilot?: AutopilotMap; hideChase?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "seller" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "snoozed">("active");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ "needs-you": false, "coming-up": true, autopilot: true });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [optimisticSnoozeAdd, setOptimisticSnoozeAdd] = useState(0);
  const { toast } = useAgentToast();

  // Pill nav: clicking a summary pill anchor-scrolls here and expands the matching section
  useEffect(() => {
    function handleHash() {
      const key = window.location.hash.replace("#section-", "");
      if (key === "escalated" || key === "overdue" || key === "due_today" || key === "upcoming") {
        setCollapsed((prev) => ({ ...prev, [key]: false }));
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

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
  const upcomingCutoffStr = toUKDateStr(addBusinessDays(now, 3));

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
    const g = classifyActive(log, now, upcomingCutoffStr);
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
      // Bypass `act` so we can read the action's discriminated result.
      // If the server reports the milestone can't be confirmed because
      // an earlier one is still outstanding, we un-hide the row and toast
      // the reason so the agent knows what to action next.
      setLoading(taskId);
      startTransition(async () => {
        try {
          const result = await completeTaskAction(taskId, "/agent/work-queue");
          if ("blocked" in result && result.blocked) {
            // Un-hide the row + clear the exit animation so it reappears.
            if (logId) {
              setHiddenIds((prev) => { const next = new Set(prev); next.delete(logId); return next; });
              setExitingIds((prev) => { const next = new Set(prev); next.delete(logId); return next; });
            }
            const names = result.missing.map((m) => m.name);
            const msg = names.length === 1
              ? `Can't confirm yet. "${names[0]}" needs to be confirmed first.`
              : `Can't confirm yet. These earlier milestones need confirming first: ${names.join(", ")}.`;
            toast.error(msg);
          }
        } finally { setLoading(null); }
      });
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
  function handleEscalate(taskId: string) {
    // 2026-07-13 (Chunk 6d/e): capture a reason on the manual escalation
    // so the escalated chip can show WHY on hover (Chunk 8) and the file's
    // activity feed records who did it and why. Empty/cancel is fine - the
    // action still escalates, just without a reason. window.prompt is
    // consistent with the other lightweight confirms in this codebase and
    // avoids adding a new modal in this pass.
    const reason = typeof window !== "undefined"
      ? window.prompt("Why are you escalating this chase?") ?? undefined
      : undefined;
    act(taskId, () => escalateTaskAction(taskId, "/agent/work-queue", reason));
  }
  function handleWakeup(logId: string) {
    setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
      act(logId, () => wakeupReminderAction(logId, "/agent/work-queue"));
    }, 150);
  }
  function handleManualChase(taskId: string) { act(taskId, () => recordManualChaseAction(taskId, "/agent/work-queue")); }
  function handleChased(taskId: string, logId?: string) {
    // Optimistic hide — chased row vanishes from the work queue
    // immediately. Server updates nextDueDate so it'll resurface in the
    // upcoming bucket when due again.
    if (logId) {
      setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
      setTimeout(() => {
        setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
      }, 150);
    }
    act(taskId, () => advanceChaseTaskAction(taskId, "/agent/work-queue"));
  }

  function toggleCollapse(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  // Full empty state (zero logs, before any filter)
  if (logs.length === 0) {
    return (
      <div className="agent-glass-strong agent-empty-card" style={{ padding: "40px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
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
      {/* Sticky filter bar. Design Lab: `reminders-filter-bar` (v06). */}
      <GlassCard
        glassId="reminders-filter-bar"
        label="Reminders · Filter bar"
        defaultVariant="v06"
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "all"    ? " on" : ""}`} onClick={() => setSideFilter("all")}>All</button>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "seller" ? " on" : ""}`} onClick={() => setSideFilter("seller")}>Seller</button>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "buyer"  ? " on" : ""}`} onClick={() => setSideFilter("buyer")}>Buyer</button>
          <button
            className="agent-link agent-link-muted"
            onClick={() => setStatusFilter(statusFilter === "active" ? "snoozed" : "active")}
            style={{ fontSize: 11, whiteSpace: "nowrap", marginLeft: "auto" }}
          >
            {statusFilter === "active"
              ? `Snoozed${snoozedCount > 0 ? ` (${snoozedCount})` : ""}`
              : "← Active"}
          </button>
        </div>
      </GlassCard>

      {/* Filtered empty states */}
      {statusFilter === "active" && !hasActiveResults && (
        <div className="agent-glass-strong agent-empty-card" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
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

      {/* Two groups — what's yours (manual) vs what the system's chasing
          (autopilot, collapsed). Within each, worst-first. */}
      {statusFilter === "active" && (() => {
        const rankOf: Record<string, number> = { escalated: 0, overdue: 1, due_today: 2, upcoming: 3 };
        const rank = (l: AgentReminderLog) => rankOf[classifyActive(l, now, upcomingCutoffStr) ?? "upcoming"];
        const worstFirst = (arr: AgentReminderLog[]) => arr.slice().sort((a, b) => rank(a) - rank(b) || new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
        const worstUrgency = (fileLogs: AgentReminderLog[]): UrgencyGroup => {
          let best: UrgencyGroup = "upcoming";
          for (const l of fileLogs) { const g = classifyActive(l, now, upcomingCutoffStr) ?? "upcoming"; if (rankOf[g] < rankOf[best]) best = g; }
          return best;
        };
        // Manual (yours) splits by urgency: due-today/overdue/escalated is "Needs
        // you"; the next 3 working days is "Coming up" (collapsed); anything further
        // out is hidden until it approaches (classifyActive returns null past the
        // window). Autopilot shows the whole forward pipeline, any date.
        const manual = filteredActive.filter((l) => autopilot?.get(l.id)?.kind !== "auto");
        const isDueNow = (l: AgentReminderLog) => { const g = classifyActive(l, now, upcomingCutoffStr); return g === "escalated" || g === "overdue" || g === "due_today"; };
        const needsYouLogs = worstFirst(manual.filter(isDueNow));
        const comingUpLogs = worstFirst(manual.filter((l) => classifyActive(l, now, upcomingCutoffStr) === "upcoming"));
        const autoLogs = worstFirst(filteredActive.filter((l) => autopilot?.get(l.id)?.kind === "auto"));
        const groups = [
          { key: "needs-you", label: "Needs you", sub: "due today or overdue", logs: needsYouLogs, you: true },
          { key: "coming-up", label: "Coming up", sub: "yours over the next few working days", logs: comingUpLogs, you: true },
          { key: "autopilot", label: "On autopilot", sub: "the system's got these", logs: autoLogs, you: false },
        ];
        // There are active reminders on the queue, but they're all manual and
        // further out than the window, so nothing surfaces yet. Say so rather than
        // leaving a blank (they'll appear in "Coming up" as they approach).
        if (hasActiveResults && needsYouLogs.length === 0 && comingUpLogs.length === 0 && autoLogs.length === 0) {
          return (
            <div className="agent-glass-strong agent-empty-card" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>
                Nothing needs you right now. Reminders appear here as they come due.
              </p>
            </div>
          );
        }
        return groups.map((grp) => {
          if (grp.logs.length === 0) return null;
          const isCollapsed = collapsed[grp.key];
          const fileGroups = groupByFile(grp.logs);
          return (
            <div key={grp.key} className="space-y-2" id={`section-${grp.key}`}>
              <div
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(grp.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(grp.key); } }}
                style={{
                  cursor: "pointer",
                  background: grp.you ? "rgba(var(--agent-coral-rgb), 0.08)" : "var(--agent-surface-glass)",
                  border: grp.you ? "0.5px solid rgba(var(--agent-coral-rgb), 0.20)" : "0.5px solid var(--agent-border-subtle)",
                }}
              >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em", color: grp.you ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)" }}>{grp.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, color: grp.you ? "var(--agent-coral-deep)" : "var(--agent-text-muted)", background: grp.you ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(148,163,184,0.16)" }}>{grp.logs.length}</span>
                  <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{grp.sub}</span>
                </div>
                <CaretDown size={12} weight="bold" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }} />
              </div>
              <div className={`agent-acc${!isCollapsed ? " open" : ""}`}>
                <div className="agent-acc-in">
                  <div className="space-y-3" style={{ padding: "4px 12px 16px" }}>
                    {fileGroups.map(({ txId, address, logs: fileLogs }) => (
                      <SplitFileCard
                        key={txId}
                        txId={txId}
                        address={address}
                        photoUrl={photoByTx?.get(txId) ?? null}
                        milestoneInfo={milestoneInfo}
                        autopilot={autopilot}
                        logs={fileLogs}
                        groupKey={worstUrgency(fileLogs)}
                        loading={loading}
                        exitingIds={exitingIds}
                        handleComplete={handleComplete}
                        handleSnooze={handleSnooze}
                        handleSnoozeAll={handleSnoozeAll}
                        handleChased={handleChased}
                        hideChase={hideChase}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        });
      })()}

      {/* Snoozed section — sorted by nextDueDate asc (= snooze end date asc, set by snoozeReminderLog) */}
      {statusFilter === "snoozed" && (
        filteredSnoozed.length === 0 ? (
          <div className="agent-glass-strong" style={{ padding: "28px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>{q ? "No matching snoozed reminders." : "No snoozed reminders."}</p>
            {!q && (
              <button
                className="agent-link agent-link-muted"
                onClick={() => setStatusFilter("active")}
                style={{ fontSize: 12, marginTop: 10 }}
              >
                ← Back to active reminders
              </button>
            )}
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
