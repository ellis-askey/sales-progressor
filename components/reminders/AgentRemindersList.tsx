"use client";

import { useState, useTransition, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretDown, CheckCircle, CalendarBlank } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { toUKDateStr, formatDate } from "@/lib/utils";
import { classifyReminder } from "@/lib/reminders/classify";
import { pickLiveChase } from "@/lib/reminders/pick-live-chase";
import { completeTaskAction, snoozeTaskAction, snoozeManyAction, wakeupReminderAction, runReminderEngineAction, advanceChaseTaskAction, advanceManyChaseTasksAction } from "@/app/actions/tasks";
import { ConfirmMilestoneDateModal, milestoneNeedsDatePrompt } from "@/components/milestones/ConfirmMilestoneDateModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { AddFirmModal } from "@/components/solicitors/AddFirmModal";
import { AddClientEmailModal } from "@/components/reminders/AddClientEmailModal";
import { saveSolicitorsAction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/Button";
import { ChaseSplitButton } from "@/components/reminders/ChaseSplitButton";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UrgencyPill, SidePill, type UrgencyBucket } from "@/components/reminders/status-pills";
import { AutoChaseCountdown, sendMoment } from "@/components/reminders/AutoChaseCountdown";
import { AutoChasePreviewModal } from "@/components/reminders/AutoChasePreviewModal";
import { SnoozeMenu, type SnoozeChoice } from "@/components/reminders/SnoozeMenu";
import type { AutopilotStatus } from "@/lib/services/reminder-autopilot";
import type { getAgentReminderLogs } from "@/lib/services/reminders";
import { withSolicitorRecipients, whoToChase, joinNames, type SolicitorRef, type ChaseContact } from "@/lib/services/chase-recipients";
import { renderChaseCardCopy } from "@/lib/chase/chase-card-copy";

type AgentReminderLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];
type MilestoneInfo = Record<string, { outstanding: string; responsible: "client" | "solicitor" | null; name?: string }>;
type AutopilotMap = Map<string, AutopilotStatus>;
type UrgencyGroup = "escalated" | "overdue" | "due_today" | "upcoming";
type LastComm = { createdAt: Date; method: string | null };

// The card headline is the reminder's OWN step — its target milestone's full
// name. NOT the anchor milestone's name: the anchor is the step the reminder
// fires *after*, which for a completion chase (VM20/PM27, anchored on the
// exchange-confirmation step) reads "…contracts have exchanged" and mislabels a
// completion chase as an exchange one. Falls back to the terse rule name when
// the target milestone isn't resolved.
function reminderDisplayName(log: AgentReminderLog, milestoneInfo?: MilestoneInfo): string {
  const code = log.reminderRule.targetMilestoneCode;
  return (code ? milestoneInfo?.[code]?.name : undefined) ?? log.reminderRule.name.replace(/^Chase:\s*/i, "");
}

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

// Duration label that reads out in full on large screens ("10 days overdue")
// and stays terse on smaller ones ("10d overdue"). Both variants render; a
// viewport breakpoint (see .wq-dur-abbr / .wq-dur-full in agent-system.css)
// picks which shows, matching how the pill label itself collapses on mobile.
function durationLabel(days: number, suffix: string): ReactNode {
  const unit = days === 1 ? "day" : "days";
  return (
    <>
      <span className="wq-dur-abbr">{days}d {suffix}</span>
      <span className="wq-dur-full">{days} {unit} {suffix}</span>
    </>
  );
}

// Urgency bucket + label for a reminder. Shared by the header pill (shown on a
// single-reminder file) and the per-row rendering, so the two always agree.
// `title` carries the plain-string tooltip when `label` is a responsive node.
function computeUrgency(
  log: AgentReminderLog,
  task: { chaseCount: number; priority: string },
): { bucket: UrgencyBucket; label: ReactNode; title?: string; hasBeenChased: boolean } {
  const todayStr = toUKDateStr(new Date());
  const dueStr = toUKDateStr(log.nextDueDate);
  const isOverdue = dueStr < todayStr;
  const isDueToday = dueStr === todayStr;
  const daysOverdue = isOverdue ? Math.floor((new Date(todayStr).getTime() - new Date(dueStr).getTime()) / 86400000) : 0;
  const hasBeenChased = (task.chaseCount ?? 0) >= 1;
  const bucket: UrgencyBucket = task.priority === "escalated" ? "escalated"
    : isOverdue ? "overdue"
    : isDueToday ? "due_today"
    : "upcoming";
  const label: ReactNode = task.priority === "escalated" ? "Escalated"
    : hasBeenChased && isOverdue ? `Was due ${formatDate(log.nextDueDate)}`
    : hasBeenChased ? `Next ${formatDate(log.nextDueDate)}`
    : isOverdue ? durationLabel(daysOverdue, "overdue")
    : isDueToday ? "Due today"
    : `Next ${formatDate(log.nextDueDate)}`;
  const title = !hasBeenChased && isOverdue && task.priority !== "escalated"
    ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`
    : undefined;
  return { bucket, label, title, hasBeenChased };
}

// Friendly label for a comm method on the chase-history line.
// "3 days ago" / "yesterday" / "today" from a timestamp.
function relativeDays(when: Date | string): string {
  const d = Math.floor((Date.now() - new Date(when).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// Who sent the last chase, for "Last chased … by <actor>": Autopilot for an
// automated send, "you" when it was the viewer, otherwise the person's name.
// Returns null when we can't attribute it (older sends with no actor stored).
function lastChaseActor(
  comm: { isAutomated?: boolean; createdById?: string | null; createdBy?: { name: string | null } | null } | undefined,
  currentUserId?: string | null,
): string | null {
  if (!comm) return null;
  if (comm.isAutomated) return "Autopilot";
  if (comm.createdById && currentUserId && comm.createdById === currentUserId) return "you";
  return comm.createdBy?.name ?? null;
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
// Shared file-card shell for the reminders family (active + snoozed): the glass
// card, the click-to-collapse property header (photo + address + town linking to
// the file), an actions slot, and the collapsing body. SplitFileCard and
// SnoozedFileCard both render through this, so the two views are one family.
function FileCardShell({
  txId,
  address,
  photoUrl,
  actions,
  children,
}: {
  txId: string;
  address: string;
  photoUrl?: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // Collapse the file's reminders by clicking its header (drawer-style).
  const [collapsed, setCollapsed] = useState(false);
  const { line, location } = splitAddress(address);
  return (
    // Design Lab: `reminders-file-card`. Default v05 per Ellis's pick, 2026-08-09.
    <GlassCard
      glassId="reminders-file-card"
      label="Reminders · File card"
      defaultVariant="v05"
      style={{ borderRadius: 20 }}
    >
      {/* Property header — click it to collapse/expand the file's reminders
          (drawer-style). The address link + the action cluster stop propagation
          so they still do their own thing. */}
      <div
        className="agent-card-hdr"
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setCollapsed((v) => !v); } }}
        style={{
          background: "var(--agent-card-header-veil)",
          padding: "10px 16px",
          borderRadius: collapsed ? 20 : "16px 20px 0 0",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          cursor: "pointer",
        }}
      >
        {/* The whole identity — photo, first line, town/postcode — links to the
            file. Hovering anywhere in it lights the first line coral (.rem-addr);
            the town/postcode stays muted. Stops propagation so it navigates
            rather than toggling the collapse. */}
        {/* Only the photo + address navigate to the file (and drive the address
            hover). Shrink-to-fit so it doesn't cover the empty header space —
            that space belongs to the header and toggles the drawer. */}
        <Link
          href={`/agent/transactions/${txId}`}
          className="agent-link"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "0 1 auto", textDecoration: "none" }}
        >
          <PropertyThumb photoUrl={photoUrl} size={48} />
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
              {/* 2-line clamp (audit A8) — the address is the card's identity. */}
              <span className="rem-addr" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minWidth: 0 }}>
                {line}
              </span>
              <LinkArrow />
            </span>
            {location && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>
            )}
          </div>
        </Link>
        {actions && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
            {actions}
          </div>
        )}
        {/* Collapse chevron — rotates down when the file is folded. */}
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", flexShrink: 0, transition: "transform 220ms cubic-bezier(0.25,0,0,1)", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
          <CaretDown size={15} weight="bold" />
        </span>
      </div>

      {/* Reminders — collapse (grid 1fr → 0fr) when the header is toggled. */}
      <div style={{ display: "grid", gridTemplateRows: collapsed ? "0fr" : "1fr", transition: "grid-template-rows 280ms cubic-bezier(0.25,0,0,1)", overflow: "hidden" }}>
        <div style={{ minHeight: 0 }}>
          <div style={{ padding: "6px 0" }}>{children}</div>
        </div>
      </div>
    </GlassCard>
  );
}

// Snoozed view, brought level with the active family (2026-09-19). Same shell,
// one row per snoozed reminder: what it is, when it wakes, and the two actions
// that matter here — extend the snooze, or wake it now. "Wake all" on the header
// for a file with several. Waking returns it to the active list (Chase/Done live
// there); every actionable control carries a hover.
function SnoozedFileCard({
  txId,
  address,
  photoUrl,
  logs,
  milestoneInfo,
  loading,
  exitingIds,
  onWakeup,
  handleSnooze,
}: {
  txId: string;
  address: string;
  photoUrl?: string | null;
  logs: AgentReminderLog[];
  milestoneInfo?: MilestoneInfo;
  loading: string | null;
  exitingIds: Set<string>;
  onWakeup: (logId: string) => void;
  handleSnooze: (taskId: string, choice: SnoozeChoice) => void;
}) {
  const isBuyerLog = (l: AgentReminderLog) => !!l.reminderRule.targetMilestoneCode?.startsWith("PM");
  // Soonest to wake first (snoozedUntil == the wake instant).
  const sorted = logs.slice().sort((a, b) =>
    new Date(a.snoozedUntil ?? a.nextDueDate).getTime() - new Date(b.snoozedUntil ?? b.nextDueDate).getTime());
  const tx = logs[0]?.transaction;

  const headerActions = sorted.length >= 2 ? (
    <button
      type="button"
      onClick={() => sorted.forEach((l) => onWakeup(l.id))}
      title="Wake every snoozed reminder on this file"
      className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
      style={{ flexShrink: 0, whiteSpace: "nowrap" }}
    >
      ↻ Wake all ({sorted.length})
    </button>
  ) : (
    // No side pill on snooze (Ellis, 2026-09-19) — just the snoozed marker.
    <span className="rem-snooze-pill">Snoozed</span>
  );

  return (
    <FileCardShell txId={txId} address={address} photoUrl={photoUrl} actions={headerActions}>
      {sorted.map((log, i) => {
        const name = reminderDisplayName(log, milestoneInfo);
        const isBuyer = isBuyerLog(log);
        const taskId = pickLiveChase(log.chaseTasks)?.id;
        const wakeLabel = log.snoozedUntil ? formatDate(log.snoozedUntil) : "soon";
        // When the step is the solicitor's to do, surface the firm and link into
        // its partner page (the firm is stored per side on the file).
        const code = log.reminderRule.targetMilestoneCode;
        const solFirm = code && milestoneInfo?.[code]?.responsible === "solicitor"
          ? (isBuyer ? tx?.purchaserSolicitorFirm : tx?.vendorSolicitorFirm)
          : null;
        return (
          <div
            key={log.id}
            className={exitingIds.has(log.id) ? "agent-row-exit" : undefined}
            style={{ padding: "10px 12px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", alignItems: "flex-start", gap: 8 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 660, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{name}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                {isBuyer ? "Buyer" : "Seller"} · <span style={{ color: "var(--agent-text-secondary)", fontWeight: 600 }}>Wakes {wakeLabel}</span>
              </p>
              {solFirm && (
                <Link
                  href={`/agent/partners/solicitor/${solFirm.id}`}
                  className="agent-link rem-sol-link"
                  style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 5, fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                >
                  {solFirm.name} <LinkArrow />
                </Link>
              )}
            </div>
            {taskId && <SnoozeMenu variant="row" onConfirm={(choice) => handleSnooze(taskId, choice)} />}
            <Button
              onClick={() => onWakeup(log.id)}
              disabled={exitingIds.has(log.id)}
              title="Wake this reminder now. It returns to your active list"
              size="sm"
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              ↻ Wake now
            </Button>
          </div>
        );
      })}
    </FileCardShell>
  );
}

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
  handleChasedAll,
  handleCompleteAll,
  hideChase,
  currentUserId,
  showRowExplain,
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
  handleSnooze: (taskId: string, choice: SnoozeChoice) => void;
  handleSnoozeAll: (logIds: string[], taskIds: string[], choice: SnoozeChoice) => void;
  handleChased: (taskId: string, logId?: string) => void;
  handleChasedAll: (items: { taskId: string; logId: string }[]) => void;
  handleCompleteAll: (tasks: { taskId: string; code: string | null }[]) => void;
  hideChase?: boolean;
  currentUserId?: string | null;
  // "Needs you" only: keep the per-step explanation box on multi-reminder files
  // too (elsewhere the multi layout collapses to a single compact meta line).
  showRowExplain?: boolean;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Collapse the file's reminders by clicking its header (drawer-style).
  const [collapsed, setCollapsed] = useState(false);
  // Add-solicitor modal, opened from a "No solicitor on file yet" row.
  const [addSolFor, setAddSolFor] = useState<"vendor" | "purchaser" | null>(null);
  // After a solicitor is added, collapse that side's "No solicitor on file"
  // affordance (fade + tighten) before the refresh swaps in the resolved state.
  const [collapsedSolSide, setCollapsedSolSide] = useState<"vendor" | "purchaser" | null>(null);
  // Add-client-email modal, opened from a "No email on file for the client" row.
  const [addEmailFor, setAddEmailFor] = useState<{ isBuyer: boolean; contacts: { id: string; name: string; roleType: string; email: string | null }[] } | null>(null);
  const [rowChase, setRowChase] = useState<{ taskId: string; name: string; chaseCount: number; isBuyer: boolean; contacts: ChaseContact[]; responsible: "client" | "solicitor" } | null>(null);
  // "View" preview of a pending auto-chase email (autopilot rows).
  const [previewRow, setPreviewRow] = useState<{ logId: string; pipeline: "client" | "solicitor"; sendLabel: string } | null>(null);
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
    .flatMap((log) => { const task = pickLiveChase(log.chaseTasks); return task ? [{ log, task }] : []; })
    .sort((a, b) => new Date(a.log.nextDueDate).getTime() - new Date(b.log.nextDueDate).getTime());
  const scheduledLogs = logs.filter((log) => !pickLiveChase(log.chaseTasks));

  const milestones = openTasks.map(({ log, task }) => ({
    chaseTaskId: task.id,
    name: log.reminderRule.name.replace(/^Chase:\s*/i, ""),
    chaseCount: task.chaseCount,
  }));
  const maxChaseCount = milestones.length > 0 ? Math.max(...milestones.map((m) => m.chaseCount)) : 0;
  const allTaskIds = openTasks.map(({ task }) => task.id);
  const allLogIds  = openTasks.map(({ log })  => log.id);
  // "Client auto-chase is off/paused" is a file-level fact (global / agency /
  // this-file switch), so it's identical across every client row on the file.
  // Surface it once as a card footer instead of repeating it on each chase.
  const clientOffReason = (() => {
    const s = openTasks.map(({ log }) => autopilot?.get(log.id)).find((a) => a?.kind === "manual" && a.category === "autochase_off");
    return s?.kind === "manual" ? s.reason : null;
  })();
  // Single open task on this file+group → side-scope the footer chase like the file tab.
  const soleOpen = openTasks.length === 1 ? openTasks[0] : null;
  const soleIsBuyer = soleOpen ? isBuyerLog(soleOpen.log) : false;
  // A file with exactly one reminder gets the full treatment: side + urgency
  // pills in the header, and the full supporting copy. Two or more collapse to
  // compact rows (a single meta line, no supporting box).
  const isSingle = logs.length === 1;

  return (
    // Design Lab: `reminders-file-card`. Default v05 per Ellis's pick, 2026-08-09.
    <GlassCard
      glassId="reminders-file-card"
      label="Reminders · File card"
      defaultVariant="v05"
      style={{ borderRadius: 20 }}
    >
      {/* Property header — click it to collapse/expand the file's reminders
          (drawer-style). The address link + the action cluster stop propagation
          so they still do their own thing. */}
      <div
        className="agent-card-hdr"
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setCollapsed((v) => !v); } }}
        style={{
          background: "var(--agent-card-header-veil)",
          padding: "10px 16px",
          borderRadius: collapsed ? 20 : "16px 20px 0 0",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          cursor: "pointer",
        }}
      >
        {/* The whole identity — photo, first line, town/postcode — links to the
            file. Hovering anywhere in it lights the first line coral (.rem-addr);
            the town/postcode stays muted. Stops propagation so it navigates
            rather than toggling the collapse. */}
        {/* Only the photo + address navigate to the file (and drive the address
            hover). Shrink-to-fit so it doesn't cover the empty header space —
            that space belongs to the header and toggles the drawer. */}
        <Link
          href={`/agent/transactions/${txId}`}
          className="agent-link"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "0 1 auto", textDecoration: "none" }}
        >
          <PropertyThumb photoUrl={photoUrl} size={48} />
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
              {/* 2-line clamp (audit A8) — the address is the card's identity. */}
              <span className="rem-addr" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minWidth: 0 }}>
                {line}
              </span>
              <LinkArrow />
            </span>
            {location && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>
            )}
          </div>
        </Link>
        {/* Whole-file actions (2+) + the single-file pills. Stops propagation so a
            click on Chase all / Snooze all doesn't also toggle the collapse. */}
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
          {!hideChase && openTasks.length >= 2 && (
            <span className="wq-allactions">
              <SnoozeMenu variant="all" count={openTasks.length} disabled={loading !== null} onConfirm={(choice) => handleSnoozeAll(allLogIds, allTaskIds, choice)} />
              <ChaseSplitButton
                label={`Chase all (${milestones.length})`}
                markChasedLabel="Mark all chased"
                markDoneLabel="Mark all done"
                onChase={() => setDrawerOpen(true)}
                onMarkChased={() => {
                  // Bump every task's optimistic chase count (card-owned state),
                  // then hand the batch to the deck for exit + server action.
                  setOptimisticChases((prev) => {
                    const next = { ...prev };
                    for (const { task } of openTasks) next[task.id] = (next[task.id] ?? task.manualChaseCount) + 1;
                    return next;
                  });
                  handleChasedAll(openTasks.map(({ log, task }) => ({ taskId: task.id, logId: log.id })));
                }}
                onMarkDone={() => handleCompleteAll(openTasks.map(({ log, task }) => ({ taskId: task.id, code: log.reminderRule.targetMilestoneCode ?? null })))}
              />
            </span>
          )}
          {isSingle && (
            (() => {
              const s = openTasks[0];
              const sLog = s?.log ?? scheduledLogs[0];
              if (!sLog) return null;
              const sBuyer = isBuyerLog(sLog);
              const u = s ? computeUrgency(s.log, s.task) : null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <SidePill isBuyer={sBuyer} />
                  {u && <UrgencyPill label={u.label} bucket={u.bucket} chased={u.hasBeenChased} title={u.title} />}
                </div>
              );
            })()
          )}
        </div>
        {/* Collapse chevron — rotates down when the file is folded. */}
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", flexShrink: 0, transition: "transform 220ms cubic-bezier(0.25,0,0,1)", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
          <CaretDown size={15} weight="bold" />
        </span>
      </div>

      {/* Reminders — collapse (grid 1fr → 0fr) when the header is toggled. */}
      <div style={{ display: "grid", gridTemplateRows: collapsed ? "0fr" : "1fr", transition: "grid-template-rows 280ms cubic-bezier(0.25,0,0,1)", overflow: "hidden" }}>
        <div style={{ minHeight: 0 }}>
      <div style={{ padding: "6px 0" }}>
        {openTasks.map(({ log, task }, i) => {
          const name = reminderDisplayName(log, milestoneInfo);
          const isBuyer = isBuyerLog(log);
          const { bucket, label: urgencyLabel } = computeUrgency(log, task);
          const urgencyColor = (bucket === "overdue" || bucket === "escalated")
            ? "var(--agent-coral-deep)"
            : bucket === "due_today" ? "var(--agent-warning)" : "var(--agent-text-muted)";
          const manualChases = Math.max(optimisticChases[task.id] ?? 0, task.manualChaseCount);
          // Optimistic "mark chased" bumps the shown count before the row exits.
          const effectiveChaseCount = task.chaseCount + Math.max(0, manualChases - task.manualChaseCount);
          const escalationLine = task.priority === "escalated"
            ? (task.escalationReason || task.escalatedAt)
              ? `Escalated${task.escalatedBy?.name ? ` by ${task.escalatedBy.name}` : ""}${task.escalatedAt ? ` on ${formatDate(task.escalatedAt)}` : ""}${task.escalationReason ? ` · ${task.escalationReason}` : ""}`
              : "Auto-escalated, no response after repeated chases"
            : undefined;

          // Enrichment (free tier) — who owes it, what it means, chase history.
          const code = log.reminderRule.targetMilestoneCode;
          const info = code ? milestoneInfo?.[code] : undefined;
          // Solicitor-owed step → surface the firm and link to its partner page
          // (the firm is stored per side on the file).
          const solFirm = info?.responsible === "solicitor"
            ? (isBuyer ? tx0?.purchaserSolicitorFirm : tx0?.vendorSolicitorFirm)
            : null;
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
          const lastComm = task.communications[0];
          // One status line (no duplication with the autopilot reason). "No reply
          // yet" is honest: the reminder is open because the client hasn't yet
          // actioned or confirmed what we chased.
          const statusLine = effectiveChaseCount === 0
            ? "Not chased yet · First nudge due"
            : `Chased ${effectiveChaseCount} time${effectiveChaseCount === 1 ? "" : "s"} · No reply yet`;
          // Attributed last-chase line: "Last chased 3 days ago by you / <name> /
          // Autopilot" (null when there's no send to attribute).
          const actor = lastChaseActor(lastComm, currentUserId);
          const lastChasedLine = lastComm
            ? `Last chased ${relativeDays(lastComm.createdAt)}${actor ? ` by ${actor}` : ""}`
            : null;

          // Dated chase line under the action buttons (mock: "Next chase due in
          // 4 days · 22 Sept"). Always shown, with the actual date — complements
          // the urgency pill, which gives the elapsed amount ("108d overdue")
          // rather than the date. Copy adapts to future / today / overdue.
          const nextChaseDays = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
          const nextChaseLabel =
            nextChaseDays >= 2 ? `Next chase due in ${nextChaseDays} days`
            : nextChaseDays === 1 ? "Next chase due tomorrow"
            : nextChaseDays === 0 ? "Chase due today"
            : "Was due";

          // #4: when the firm is on file and its name sits in the title, link it
          // there (hover → primary) and drop the separate firm link below.
          const desktopTitle = copy?.step ?? name;
          const linkFirmInTitle = !!solFirm && desktopTitle.includes(solFirm.name);

          const isExiting = exitingIds.has(log.id);
          const autoState = autopilot?.get(log.id);
          const isAuto = autoState?.kind === "auto";

          // Shared row pieces so the autopilot layout (strings + green countdown
          // both full-width, actions on their own line below) and the normal
          // layout (content flexes, actions inline) render the same content.
          const stringsEl = (
            <>
              {/* Title first; the side + urgency pills live in the header on a
                  single-reminder file. Desktop: fuller sentence step name;
                  mobile: the terse milestone name (CSS toggles). */}
              <p style={{ margin: 0, fontSize: 13, fontWeight: 660, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
                <span className="rem-step-desktop">
                  {linkFirmInTitle && solFirm ? (() => {
                    const idx = desktopTitle.indexOf(solFirm.name);
                    return (
                      <>
                        {desktopTitle.slice(0, idx)}
                        <Link href={`/agent/partners/solicitor/${solFirm.id}`} className="rem-firm-link">{solFirm.name}</Link>
                        {desktopTitle.slice(idx + solFirm.name.length)}
                      </>
                    );
                  })() : desktopTitle}
                </span>
                <span className="rem-step-mobile">{name}</span>
              </p>
              {isSingle ? (
                <>
                  {who && (
                    <p className="rem-chasing-line" style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                      Chasing <b style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>{who.name}</b>{who.role ? ` · the ${who.role}` : ""}
                    </p>
                  )}
                  {(copy?.line ?? info?.outstanding) && (
                    <p style={{ margin: "7px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderLeft: "2px solid var(--agent-border-default)", borderRadius: "0 8px 8px 0", padding: "6px 10px" }}>
                      {copy?.line ?? info?.outstanding}
                    </p>
                  )}
                  <p style={{ margin: "7px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>↻ {statusLine}</p>
                  {lastChasedLine && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-disabled)" }}>{lastChasedLine}</p>
                  )}
                </>
              ) : (
                // Multiple reminders on one file: a compact meta line. In "Needs
                // you" we also keep the per-step explanation box so every actionable
                // row still says what's outstanding (elsewhere it stays collapsed).
                <>
                  <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                    {isBuyer ? "Buyer" : "Seller"} · <span style={{ color: urgencyColor, fontWeight: 600 }}>{urgencyLabel}</span> · {effectiveChaseCount === 0 ? "Not chased yet" : `Chased ${effectiveChaseCount}×`}
                  </p>
                  {showRowExplain && (copy?.line ?? info?.outstanding) && (
                    <p style={{ margin: "7px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderLeft: "2px solid var(--agent-border-default)", borderRadius: "0 8px 8px 0", padding: "6px 10px" }}>
                      {copy?.line ?? info?.outstanding}
                    </p>
                  )}
                </>
              )}
              {solFirm && !linkFirmInTitle && (
                <Link
                  href={`/agent/partners/solicitor/${solFirm.id}`}
                  className="agent-link rem-sol-link"
                  style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 6, fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                >
                  {solFirm.name} <LinkArrow />
                </Link>
              )}
              {escalationLine && (
                <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>⚑ {escalationLine}</p>
              )}
              {/* Manual reason, by category. "exhausted" is suppressed — the
                  status line above already says "chased N · no reply yet", so
                  showing it again is the old duplication. Missing solicitor /
                  client email render as actionable add affordances; everything
                  else (paused, off, opted-out) is plain informational text. */}
              {autoState?.kind === "manual" && autoState.category === "blocker_solicitor" && (
                <div style={{
                  display: "grid",
                  gridTemplateRows: collapsedSolSide === (isBuyer ? "purchaser" : "vendor") ? "0fr" : "1fr",
                  opacity: collapsedSolSide === (isBuyer ? "purchaser" : "vendor") ? 0 : 1,
                  transition: "grid-template-rows 340ms cubic-bezier(0.25,0,0,1), opacity 260ms ease",
                  overflow: "hidden",
                }}>
                  <div style={{ minHeight: 0 }}>
                    <button
                      type="button"
                      onClick={() => setAddSolFor(isBuyer ? "purchaser" : "vendor")}
                      className="agent-link"
                      style={{ margin: "8px 0 0", display: "inline-flex", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                    >
                      {autoState.reason ?? "No solicitor on file yet"} <LinkArrow />
                    </button>
                  </div>
                </div>
              )}
              {autoState?.kind === "manual" && autoState.category === "blocker_client_email" && (
                <button
                  type="button"
                  onClick={() => setAddEmailFor({ isBuyer, contacts: contacts.filter((c) => c.roleType === (isBuyer ? "purchaser" : "vendor")).map((c) => ({ id: c.id, name: c.name, roleType: c.roleType, email: c.email })) })}
                  className="agent-link"
                  style={{ margin: "8px 0 0", display: "inline-flex", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                >
                  Add an email to chase them <LinkArrow />
                </button>
              )}
              {/* Info reasons (paused / off / opted-out) render in the right
                  action column instead — centred under the date (see below). */}
            </>
          );

          const actionsEl = (
            <>
              <SnoozeMenu variant="row" onConfirm={(choice) => handleSnooze(task.id, choice)} />
              {hideChase ? (
                // No sending here, but keep Mark chased + Done available inline.
                <>
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
                </>
              ) : (
                // Deck primary: Chase is the split-CTA; its chevron holds Mark
                // chased + Mark done. Same actions, reorganised. Snooze is its own.
                <ChaseSplitButton
                  onChase={() => setRowChase({ taskId: task.id, name, chaseCount: task.chaseCount, isBuyer, contacts: contactsForSide(isBuyer), responsible: info?.responsible === "solicitor" ? "solicitor" : "client" })}
                  onMarkChased={() => optimisticChase(task.id, log.id, task.manualChaseCount)}
                  onMarkDone={() => handleComplete(task.id)}
                  disabled={isExiting}
                />
              )}
            </>
          );

          return (
            <div
              key={log.id}
              className={isExiting ? "agent-row-exit" : (loading === task.id ? "agent-row-flash" : undefined)}
              style={{ padding: "10px 12px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", flexDirection: isAuto ? "column" : "row", alignItems: "stretch", gap: 8 }}
            >
              {isAuto ? (
                // Autopilot: the strings and the green auto-chase countdown each
                // span the full card width; the row's actions sit on their own
                // right-aligned line below. Nothing else about the row changes.
                <>
                  <div style={{ minWidth: 0 }}>{stringsEl}</div>
                  {autoState?.kind === "auto" && (
                    <AutoChaseCountdown iso={autoState.nextSend} onView={() => setPreviewRow({ logId: log.id, pipeline: autoState.pipeline, sendLabel: sendMoment(autoState.nextSend) })} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>{actionsEl}</div>
                </>
              ) : (
                // Needs-you: content on the left, a hairline divider, then the
                // action column — Chase on top, the next-chase date beneath —
                // vertically centred against the content (mock, 2026-09-21).
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>{stringsEl}</div>
                  <div style={{
                    flexShrink: 0,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 10,
                    borderLeft: "0.5px solid var(--agent-border-subtle)", paddingLeft: 14, marginLeft: 4,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actionsEl}</div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{nextChaseLabel}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        <CalendarBlank size={13} weight="regular" aria-hidden /> {formatDate(task.dueDate)}
                      </span>
                    </div>
                    {autoState?.kind === "manual" && autoState.category === "info" && autoState.reason && (
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)", textAlign: "center", maxWidth: 160 }}>{autoState.reason}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {scheduledLogs.map((log, i) => {
          const name = reminderDisplayName(log, milestoneInfo);
          const isBuyer = isBuyerLog(log);
          const dueDate = new Date(log.nextDueDate);
          const dueDateLabel = dueDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          // Same supporting sentence as an active chase, so a scheduled reminder
          // still explains who needs to do what (tokens filled for this file+side).
          const code = log.reminderRule.targetMilestoneCode;
          const info = code ? milestoneInfo?.[code] : undefined;
          const clientRole = isBuyer ? "purchaser" : "vendor";
          const clientList = contacts.filter((c) => c.roleType === clientRole).map((c) => c.name);
          const clientNames = clientList.length > 0 ? joinNames(clientList) : (isBuyer ? "the buyer" : "the seller");
          const sideSol = isBuyer ? purchaserSolicitor : vendorSolicitor;
          const solicitorFirm = sideSol?.firm?.name || sideSol?.name || (isBuyer ? "the buyer's solicitor" : "the seller's solicitor");
          const copy = renderChaseCardCopy(code, clientNames, solicitorFirm, clientList.length <= 1);
          const supporting = copy?.line ?? info?.outstanding;
          return (
            <div
              key={log.id}
              style={{ padding: "7px 12px", borderTop: (i > 0 || openTasks.length > 0) ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", alignItems: "flex-start", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{name}</p>
                {isSingle ? (
                  <>
                    {supporting && (
                      <p style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderLeft: "2px solid var(--agent-border-default)", borderRadius: "0 8px 8px 0", padding: "6px 10px" }}>
                        {supporting}
                      </p>
                    )}
                    <p style={{ margin: "6px 0 0", fontSize: 10, fontWeight: 500, color: "var(--agent-text-muted)" }}>Due {dueDateLabel}</p>
                  </>
                ) : (
                  <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                    {isBuyer ? "Buyer" : "Seller"} · Due {dueDateLabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {/* File-level footer: client auto-chase off/paused, shown once (a divider
            line then centred text) rather than repeated on every chase row. */}
        {clientOffReason && (
          <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", margin: "6px 12px 0", paddingTop: 8, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}>{clientOffReason}</p>
          </div>
        )}
      </div>
        </div>
      </div>

      {/* Add-solicitor modal, opened from a "No solicitor on file yet" row. On
          save it creates the firm + handler and attaches it to this side of the
          file (partial patch, other side untouched), then refreshes. */}
      {addSolFor && (
        <AddFirmModal
          prefillName=""
          onClose={() => setAddSolFor(null)}
          onCreated={async (firm, handler) => {
            if (handler) {
              try {
                await saveSolicitorsAction(
                  txId,
                  addSolFor === "vendor"
                    ? { vendorSolicitorFirmId: firm.id, vendorSolicitorContactId: handler.id }
                    : { purchaserSolicitorFirmId: firm.id, purchaserSolicitorContactId: handler.id },
                );
              } catch { /* leave it; the file just keeps the "add solicitor" nudge */ }
            }
            const side = addSolFor;
            setAddSolFor(null);
            // Collapse the affordance (fade + tighten), then refresh once it's
            // eased shut so the resolved row swaps in behind the animation.
            setCollapsedSolSide(side);
            setTimeout(() => router.refresh(), 380);
          }}
        />
      )}

      {/* Add-client-email modal, opened from a "No email on file for the client"
          row. Writes onto the existing contact, then refreshes so the row can
          return to autopilot. */}
      {addEmailFor && (
        <AddClientEmailModal
          contacts={addEmailFor.contacts}
          isBuyer={addEmailFor.isBuyer}
          onClose={() => setAddEmailFor(null)}
          onSaved={() => { setAddEmailFor(null); router.refresh(); }}
        />
      )}

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
          preferRole={rowChase.responsible}
          onClose={() => setRowChase(null)}
          onSent={() => {
            const match = openTasks.find(({ task }) => task.id === rowChase.taskId);
            handleChased(rowChase.taskId, match?.log.id);
            setRowChase(null);
          }}
        />
      )}

      {/* Auto-chase email preview ("View" on an autopilot row) */}
      {previewRow && (
        <AutoChasePreviewModal
          open
          onClose={() => setPreviewRow(null)}
          logId={previewRow.logId}
          pipeline={previewRow.pipeline}
          transactionId={txId}
          sendLabel={previewRow.sendLabel}
        />
      )}
    </GlassCard>
  );
}

export function AgentRemindersList({ logs, photoByTx, milestoneInfo, autopilot, hideChase, currentUserId }: { logs: AgentReminderLog[]; photoByTx?: Map<string, string | null>; milestoneInfo?: MilestoneInfo; autopilot?: AutopilotMap; hideChase?: boolean; currentUserId?: string | null }) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "seller" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "snoozed">("active");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ "needs-you": false, "coming-up": true, autopilot: true });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  // Exchange/completion date prompt — open when a VM19/PM26/VM20/PM27 "Done"
  // is clicked, so the real event date is captured before confirming.
  const [datePrompt, setDatePrompt] = useState<{ taskId: string; code: string | null } | null>(null);
  // Remaining date-needing steps from a "Mark all done" — prompted one modal at
  // a time; cancelling the modal drops the rest (those steps stay open).
  const [donePromptQueue, setDonePromptQueue] = useState<{ taskId: string; code: string | null }[]>([]);
  const [optimisticSnoozeAdd, setOptimisticSnoozeAdd] = useState(0);
  const { toast } = useAgentToast();

  // Pill nav: clicking a summary pill expands the matching section AND smooth-
  // scrolls it into view. The native anchor jump lands instantly on a collapsed
  // section (often below the fold, e.g. coming-up); we expand first, then after
  // the accordion has begun opening (double rAF) we scroll so the open animation
  // is visible and the section ends up properly in frame.
  useEffect(() => {
    function handleHash() {
      const key = window.location.hash.replace("#section-", "");
      // Section keys after the deck rebuild — the pills link to these ids.
      if (key === "needs-you" || key === "coming-up" || key === "autopilot") {
        setCollapsed((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }));
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    runReminderEngineAction("/agent/work-queue")
      // Phase 4 (2026-09-18, PERF-03): the action revalidates this page;
      // its response already re-renders the list - no second refresh.
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
  // Exchange/completion steps (VM19/PM26/VM20/PM27) capture the real event
  // date before confirming, exactly like the Steps tab. handleComplete opens
  // the date prompt for those; every other step confirms in one click.
  function runComplete(taskId: string, eventDate?: string) {
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
          const result = await completeTaskAction(taskId, "/agent/work-queue", eventDate);
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

  function handleComplete(taskId: string) {
    const logId = taskToLogId.get(taskId);
    const log = logs.find((l) => l.id === logId);
    const code = log?.reminderRule.targetMilestoneCode ?? null;
    if (milestoneNeedsDatePrompt(code)) {
      setDatePrompt({ taskId, code });
      return;
    }
    runComplete(taskId);
  }
  function handleSnooze(taskId: string, choice: SnoozeChoice) {
    const logId = taskToLogId.get(taskId);
    if (logId) setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      hideByTaskId(taskId);
      setOptimisticSnoozeAdd((n) => n + 1);
      act(taskId, () => snoozeTaskAction(taskId, choice, "/agent/work-queue"));
    }, 150);
  }
  function handleSnoozeAll(logIds: string[], taskIds: string[], choice: SnoozeChoice) {
    setExitingIds((prev) => {
      const next = new Set(prev);
      logIds.forEach((id) => next.add(id));
      return next;
    });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); logIds.forEach((id) => next.add(id)); return next; });
      setOptimisticSnoozeAdd((n) => n + taskIds.length);
      act(taskIds[0] ?? "", () => snoozeManyAction(taskIds, choice, "/agent/work-queue"));
    }, 150);
  }
  // "Mark all chased" (Chase all chevron): every open task on the file advances
  // in one server round-trip + one revalidate. Same optimistic exit shape as
  // Snooze all; the per-task chase-count bump happens card-side (it owns that
  // state), exactly as optimisticChase wraps handleChased for a single row.
  function handleChasedAll(items: { taskId: string; logId: string }[]) {
    setExitingIds((prev) => { const next = new Set(prev); items.forEach((it) => next.add(it.logId)); return next; });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); items.forEach((it) => next.add(it.logId)); return next; });
      act(items[0]?.taskId ?? "", () => advanceManyChaseTasksAction(items.map((it) => it.taskId), "/agent/work-queue"));
    }, 150);
  }
  // "Mark all done" (Chase all chevron): steps that need no event date complete
  // straight away (each through the same per-task path, so a blocked step
  // un-hides itself with its toast exactly as a single Done does). Steps whose
  // milestone requires an event date queue up behind the date modal one at a
  // time — a batch must never invent or skip a real event date.
  function handleCompleteAll(tasks: { taskId: string; code: string | null }[]) {
    const prompts: { taskId: string; code: string | null }[] = [];
    for (const t of tasks) {
      if (milestoneNeedsDatePrompt(t.code)) prompts.push(t);
      else runComplete(t.taskId);
    }
    if (prompts.length > 0) {
      setDonePromptQueue(prompts.slice(1));
      setDatePrompt(prompts[0]);
    }
  }
  function handleWakeup(logId: string) {
    setExitingIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
    setTimeout(() => {
      setHiddenIds((prev) => { const next = new Set(prev); next.add(logId); return next; });
      act(logId, () => wakeupReminderAction(logId, "/agent/work-queue"));
    }, 150);
  }
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

      {/* Keyed on the view so switching active ↔ snoozed fades the list up
          instead of snapping (critique, 2026-09-23). The sticky search card
          stays outside so it never re-animates. */}
      <div key={statusFilter} className="wq-view-swap space-y-5">

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
          { key: "needs-you", label: "Needs you", sub: "Due today or overdue", logs: needsYouLogs, you: true },
          { key: "coming-up", label: "Coming up", sub: "Yours over the next few working days", logs: comingUpLogs, you: true },
          { key: "autopilot", label: "On autopilot", sub: "The system's got these", logs: autoLogs, you: false },
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
        const renderGroup = (grp: (typeof groups)[number]) => {
          if (grp.logs.length === 0) return null;
          const isCollapsed = collapsed[grp.key];
          const fileGroups = groupByFile(grp.logs);
          return (
            <div key={grp.key} className="space-y-2" id={`section-${grp.key}`} style={{ scrollMarginTop: 80 }}>
              <div
                className={`agent-wq-secbar ${grp.you ? "agent-wq-secbar--you" : "agent-wq-secbar--auto"} flex items-center justify-between px-3 py-2 rounded-xl`}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(grp.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(grp.key); } }}
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em", color: grp.you ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)" }}>{grp.label}</span>
                  <span className={`agent-wq-count ${grp.you ? "agent-wq-count--coral" : "agent-wq-count--muted"}`}>{grp.logs.length}</span>
                  <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{grp.sub}</span>
                </div>
                <CaretDown size={12} weight="bold" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }} />
              </div>
              <div className={`agent-acc wq-acc${!isCollapsed ? " open" : ""}`}>
                <div className="agent-acc-in">
                  {/* No horizontal padding: the cards span the same width as the
                      section bar above them (the .wq-acc clip box carries the side
                      room for shadows — 16px mobile, 22px tablet+). 40px bottom so
                      the last card's soft shadow isn't clipped by the accordion's
                      overflow. A query container so the "Chase all / Snooze all"
                      cluster can hide when the column is too narrow for it. */}
                  <div className="space-y-3 wq-cardq" style={{ padding: "4px 0 40px" }}>
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
                        showRowExplain={grp.key === "needs-you"}
                        loading={loading}
                        exitingIds={exitingIds}
                        handleComplete={handleComplete}
                        handleSnooze={handleSnooze}
                        handleSnoozeAll={handleSnoozeAll}
                        handleChased={handleChased}
                        handleChasedAll={handleChasedAll}
                        handleCompleteAll={handleCompleteAll}
                        hideChase={hideChase}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        };
        // Your work (Needs you + Coming up) stacks in the main column; On
        // autopilot moves into a second column at ≥1280px so the two reading
        // modes — "act on these" vs "the system's got these" — sit side by side
        // instead of pushing the pipeline far down the page. Below that it all
        // stacks in one column, worst-first, as before.
        const youNodes = groups.filter((g) => g.you).map(renderGroup).filter(Boolean);
        const autoNodes = groups.filter((g) => !g.you).map(renderGroup).filter(Boolean);
        return (
          <div className={`wq-groupcols${autoNodes.length ? " has-auto" : ""}`}>
            <div className="wq-groupcol space-y-5">{youNodes}</div>
            {autoNodes.length > 0 && (
              <div className="wq-groupcol wq-groupcol--auto space-y-5">{autoNodes}</div>
            )}
          </div>
        );
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
          <div className="space-y-3">
            {groupByFile(filteredSnoozed).map(({ txId, address, logs: fileLogs }) => (
              <SnoozedFileCard
                key={txId}
                txId={txId}
                address={address}
                photoUrl={photoByTx?.get(txId) ?? null}
                logs={fileLogs}
                milestoneInfo={milestoneInfo}
                loading={loading}
                exitingIds={exitingIds}
                onWakeup={handleWakeup}
                handleSnooze={handleSnooze}
              />
            ))}
          </div>
        )
      )}

      </div>

      <ConfirmMilestoneDateModal
        open={!!datePrompt}
        milestoneCode={datePrompt?.code ?? null}
        onConfirm={(eventDate) => {
          const p = datePrompt;
          if (p) runComplete(p.taskId, eventDate);
          // Next date-needing step from a "Mark all done", if any.
          const [nextPrompt, ...rest] = donePromptQueue;
          setDonePromptQueue(rest);
          setDatePrompt(nextPrompt ?? null);
        }}
        onClose={() => { setDonePromptQueue([]); setDatePrompt(null); }}
      />
    </div>
  );
}
