"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, CaretDown, CaretUp } from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";
import { ChaseButton } from "@/components/chase/ChaseButton";

export type Contact = {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
};

export type CardLog = {
  id: string;
  nextDueDate: Date;
  snoozedUntil: Date | null;
  sourceDateUsed?: Date | null;
  reminderRule: {
    name: string;
    description?: string | null;
    targetMilestoneCode: string | null;
    repeatEveryDays: number;
    escalateAfterChases: number;
    graceDays?: number;
    anchorMilestone?: { name: string } | null;
  };
  chaseTasks: {
    id: string;
    status: string;
    priority: string;
    chaseCount: number;
    dueDate: Date;
    communications: { createdAt: Date; method: string | null }[];
  }[];
};

const SNOOZE_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
  { label: "7 days",   hours: 168 },
  { label: "14 days",  hours: 336 },
];

// Border colours per urgency — 4px left stripe
const LEFT_BORDER: Record<string, string> = {
  escalated: "#dc2626",               // red-600
  overdue:   "#ea580c",               // orange-600
  due_today: "#d97706",               // amber-600
  upcoming:  "rgba(148,163,184,0.4)", // slate-300/40
  snoozed:   "rgba(168,85,247,0.5)",  // purple-500/50
};

function stripChase(name: string) {
  return name.replace(/^Chase:\s*/i, "");
}

function relativeShort(d: Date | string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function methodDisplay(method: string | null) {
  if (!method) return null;
  const map: Record<string, string> = {
    whatsapp: "WhatsApp", email: "email", call: "call",
    sms: "SMS", letter: "letter", portal: "portal",
  };
  return map[method] ?? method;
}

function getPartyFromCode(code: string | null): "vendor" | "purchaser" | null {
  if (!code) return null;
  if (code.startsWith("VM")) return "vendor";
  if (code.startsWith("PM")) return "purchaser";
  return null;
}

function filterContactsForChase(contacts: Contact[], code: string | null): Contact[] {
  const party = getPartyFromCode(code);
  if (!party) return contacts;
  const primary = contacts.filter((c) => c.roleType === party);
  const solicitors = contacts.filter((c) => c.roleType === "solicitor");
  const filtered = [...primary, ...solicitors];
  return filtered.length > 0 ? filtered : contacts;
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
        title="Snooze"
        className="reminder-action-btn reminder-snooze-btn"
      >
        <Clock weight="regular" className="reminder-action-icon" />
        <span className="reminder-btn-label">Snooze</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 min-w-[130px]" style={{ background: "rgba(255,255,255,0.97)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.07)" }}>
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

function KebabMenu({ taskId, isEscalated, disabled, onEscalate, onManualChase }: {
  taskId: string;
  isEscalated: boolean;
  disabled: boolean;
  onEscalate: (id: string) => void;
  onManualChase?: (id: string) => void;
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
        className="px-2.5 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/40 transition-colors disabled:opacity-40 reminder-overflow-btn"
        title="More actions"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 min-w-[160px]" style={{ background: "rgba(255,255,255,0.97)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.07)" }}>
          {onManualChase && (
            <button
              onClick={() => { onManualChase(taskId); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-slate-900/70 hover:bg-white/40 transition-colors"
            >
              Chased manually
            </button>
          )}
          {!isEscalated && (
            <button
              onClick={() => { onEscalate(taskId); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50/60 transition-colors"
            >
              ↑ Escalate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ReminderCardProps {
  log: CardLog;
  transactionId: string;
  contacts: Contact[];
  propertyAddress: string;
  showAddressLink?: boolean;
  isLoading: string | null;
  isPending?: boolean;
  onComplete: (taskId: string) => void;
  onSnooze: (taskId: string, hours: number) => void;
  onEscalate: (taskId: string) => void;
  onWakeup?: (logId: string) => void;
  onManualChase?: (taskId: string) => void;
  mode?: "active" | "snoozed";
  grouped?: boolean;
  lastComm?: { createdAt: Date; method: string | null } | null;
  totalActiveOnFile?: number;
}

export function ReminderCard({
  log,
  transactionId,
  contacts,
  propertyAddress,
  showAddressLink = false,
  isLoading,
  isPending = false,
  onComplete,
  onSnooze,
  onEscalate,
  onWakeup,
  onManualChase,
  mode = "active",
  grouped = false,
  lastComm,
  totalActiveOnFile,
}: ReminderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const openTask = log.chaseTasks.find((t) => t.status === "pending") ?? null;
  const isEscalated = openTask?.priority === "escalated";
  const dueDate = new Date(log.nextDueDate); dueDate.setHours(0, 0, 0, 0);
  const isOverdue = dueDate < today;
  const isDueToday = dueDate.getTime() === today.getTime();
  const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;

  const party = getPartyFromCode(log.reminderRule.targetMilestoneCode);
  const partyLabel = party === "vendor" ? "Seller" : party === "purchaser" ? "Buyer" : null;
  const partyPillClass = party === "vendor"
    ? "bg-orange-50 text-orange-600 border border-orange-100"
    : party === "purchaser"
      ? "bg-blue-50 text-blue-600 border border-blue-100"
      : "";

  const chaseContacts = filterContactsForChase(contacts, log.reminderRule.targetMilestoneCode);
  const contactName = chaseContacts[0]?.name ?? null;

  // Status bar chase summary (uses this task's last comm)
  const taskLastComm = openTask?.communications?.[0] ?? null;
  const taskMethodLabel = methodDisplay(taskLastComm?.method ?? null);
  const chaseSummary = openTask && openTask.chaseCount > 0
    ? `${openTask.chaseCount} chase${openTask.chaseCount > 1 ? "s" : ""} sent${taskLastComm ? ` · last ${relativeShort(taskLastComm.createdAt)}${taskMethodLabel ? ` via ${taskMethodLabel}` : ""}` : ""}`
    : "";

  // Expanded panel: last contact across whole file
  const fileMethodLabel = methodDisplay(lastComm?.method ?? null);
  const lastContactText = lastComm
    ? `Last contact: ${fileMethodLabel ? `via ${fileMethodLabel}, ` : ""}${relativeShort(lastComm.createdAt)}`
    : "No contact logged on this file yet.";

  const hasMoreDetails = !!(openTask || log.sourceDateUsed || log.reminderRule.anchorMilestone);

  // ── Urgency for left-border ────────────────────────────────────────────────
  let urgencyKey = "upcoming";
  if (isEscalated) urgencyKey = "escalated";
  else if (isOverdue) urgencyKey = "overdue";
  else if (isDueToday) urgencyKey = "due_today";
  const leftBorder = LEFT_BORDER[urgencyKey];

  // ── Snoozed mode ──────────────────────────────────────────────────────────
  if (mode === "snoozed") {
    const card = (
      <>
        <div className="px-4 py-1.5 text-xs font-medium bg-purple-50/60 text-purple-600 flex items-center justify-between" style={{ borderRadius: grouped ? 0 : "20px 20px 0 0" }}>
          <span>Wakes {formatDate(log.snoozedUntil!)}</span>
          {onWakeup && (
            <button
              onClick={() => onWakeup(log.id)}
              disabled={isLoading === log.id || isPending}
              className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-40"
            >
              {isLoading === log.id ? "…" : "Wake now"}
            </button>
          )}
        </div>
        <div className="px-5 py-3">
          {showAddressLink && (
            <Link
              href={`/agent/transactions/${transactionId}`}
              className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors block mb-1"
            >
              {propertyAddress} →
            </Link>
          )}
          {contactName && <p className="text-xs text-slate-900/40 mb-0.5">{contactName}</p>}
          <p className="text-sm font-medium text-slate-900/80">{stripChase(log.reminderRule.name)}</p>
          {partyLabel && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${partyPillClass}`}>
                Waiting on {partyLabel}
              </span>
            </div>
          )}
        </div>
      </>
    );

    if (grouped) return <div>{card}</div>;
    return (
      <div className="glass-card border border-purple-200/60" style={{ borderRadius: 20, borderLeft: `4px solid ${LEFT_BORDER.snoozed}` }}>
        {card}
      </div>
    );
  }

  // ── Active header bar ──────────────────────────────────────────────────────
  let headerBg = "bg-white/20 text-slate-900/50";
  let headerLeft: string;

  if (isEscalated) {
    headerBg = "bg-red-50/60 text-red-700";
    headerLeft = `Escalated${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : isDueToday ? " · due today" : ""}`;
  } else if (isOverdue) {
    headerBg = "bg-orange-50/60 text-orange-600";
    headerLeft = `Overdue ${daysOverdue}d`;
  } else if (isDueToday) {
    headerBg = "bg-amber-50/60 text-amber-600";
    headerLeft = "Due today";
  } else {
    headerLeft = `Due ${formatDate(log.nextDueDate)}`;
  }

  const cardBody = (
    <>
      {/* Status bar */}
      <div
        className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between ${headerBg}`}
        style={{ borderRadius: grouped ? 0 : "20px 20px 0 0" }}
      >
        <span>{headerLeft}</span>
        {chaseSummary && <span className="opacity-60 truncate ml-3">{chaseSummary}</span>}
      </div>

      {/* Body */}
      <div className="px-5 py-3">
        {showAddressLink && (
          <Link
            href={`/agent/transactions/${transactionId}`}
            className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors block mb-2"
          >
            {propertyAddress} →
          </Link>
        )}

        <div className="flex items-start gap-3">
          {/* Info column */}
          <div className="flex-1 min-w-0 space-y-1">
            {contactName && (
              <p className="text-xs text-slate-900/40">{contactName}</p>
            )}
            <p className={`text-sm font-semibold leading-snug ${isEscalated ? "text-red-700" : "text-slate-900/90"}`}>
              {stripChase(log.reminderRule.name)}
            </p>
            {log.reminderRule.description && (
              <p className="text-xs text-slate-900/50">{log.reminderRule.description}</p>
            )}
            {partyLabel && (
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${partyPillClass}`}>
                Waiting on {partyLabel}
              </span>
            )}
            {/* Show / Hide details toggle */}
            {hasMoreDetails && (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="text-xs text-slate-900/35 hover:text-slate-900/60 transition-colors flex items-center gap-1"
              >
                {expanded
                  ? <><CaretUp weight="bold" style={{ width: 10, height: 10 }} /> Hide details</>
                  : <><CaretDown weight="bold" style={{ width: 10, height: 10 }} /> Show details</>
                }
              </button>
            )}
            {expanded && (
              <div className="text-xs text-slate-900/50 space-y-1 pt-2 border-t border-slate-200/40 mt-1">
                <p>{lastContactText}</p>
                {openTask && (
                  <p>
                    {openTask.chaseCount === 0
                      ? "Not yet chased"
                      : `Chased ${openTask.chaseCount}× already`}
                  </p>
                )}
                {!grouped && totalActiveOnFile !== undefined && totalActiveOnFile > 1 && (
                  <p>{totalActiveOnFile - 1} other reminder{totalActiveOnFile - 1 > 1 ? "s" : ""} active on this file</p>
                )}
                {log.reminderRule.description ? null : (log.reminderRule.anchorMilestone?.name) && (
                  <p>Reminder rule: Chase after {log.reminderRule.anchorMilestone.name}{log.reminderRule.graceDays ? ` (${log.reminderRule.graceDays}d grace)` : ""}</p>
                )}
              </div>
            )}
          </div>

          {/* Actions column */}
          {openTask && (
            <div className="shrink-0 flex items-center gap-1.5">
              {/* Confirm (milestone confirmed) — promoted to primary */}
              <button
                onClick={() => onComplete(openTask.id)}
                disabled={isLoading === openTask.id || isPending}
                title="Milestone confirmed"
                className="reminder-action-btn reminder-confirm-btn"
              >
                <CheckCircle weight="fill" className="reminder-action-icon" />
                <span className="reminder-btn-label">Confirm</span>
              </button>
              <ChaseButton
                chaseTaskId={openTask.id}
                transactionId={transactionId}
                propertyAddress={propertyAddress}
                milestoneName={stripChase(log.reminderRule.name)}
                chaseCount={openTask.chaseCount}
                contacts={chaseContacts}
                onSent={() => onComplete(openTask.id)}
              />
              <SnoozeDropdown
                taskId={openTask.id}
                onSnooze={onSnooze}
                disabled={isLoading === openTask.id || isPending}
              />
              <KebabMenu
                taskId={openTask.id}
                isEscalated={isEscalated}
                disabled={isLoading === openTask.id || isPending}
                onEscalate={onEscalate}
                onManualChase={onManualChase}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (grouped) return <div>{cardBody}</div>;

  return (
    <div
      className="glass-card"
      style={{ borderRadius: 20, borderLeft: `4px solid ${leftBorder}` }}
    >
      {cardBody}
    </div>
  );
}
