"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
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
  reminderRule: {
    name: string;
    description?: string | null;
    targetMilestoneCode: string | null;
    repeatEveryDays: number;
    escalateAfterChases: number;
    graceDays?: number;
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

function stripChase(name: string) {
  return name.replace(/^Chase:\s*/i, "");
}

function relativeShort(d: Date | string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
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
        className="px-3 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/40 transition-colors disabled:opacity-40"
      >
        Snooze
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 glass-card-strong min-w-[130px]">
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

interface ReminderCardProps {
  log: CardLog;
  transactionId: string;
  contacts: Contact[];
  propertyAddress: string;
  showAddressLink?: boolean;
  isLoading: string | null;
  isPending: boolean;
  onComplete: (taskId: string) => void;
  onSnooze: (taskId: string, hours: number) => void;
  onEscalate: (taskId: string) => void;
  onWakeup?: (logId: string) => void;
  mode?: "active" | "snoozed";
}

export function ReminderCard({
  log,
  transactionId,
  contacts,
  propertyAddress,
  showAddressLink = false,
  isLoading,
  isPending,
  onComplete,
  onSnooze,
  onEscalate,
  onWakeup,
  mode = "active",
}: ReminderCardProps) {
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
  const lastComm = openTask?.communications?.[0] ?? null;
  const methodLabel = lastComm?.method === "whatsapp" ? "WhatsApp" : lastComm?.method ?? null;

  // ── Snoozed mode ──────────────────────────────────────────────────────────
  if (mode === "snoozed") {
    return (
      <div className="glass-card border border-purple-200/60" style={{ clipPath: "inset(0 round 20px)" }}>
        <div className="px-4 py-1.5 text-xs font-medium bg-purple-50/60 text-purple-600 flex items-center justify-between">
          <span>Snoozed until {formatDate(log.snoozedUntil!)}</span>
          {onWakeup && (
            <button
              onClick={() => onWakeup(log.id)}
              disabled={isLoading === log.id || isPending}
              className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-40"
            >
              {isLoading === log.id ? "…" : "Wake up →"}
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
          <p className="text-sm font-medium text-slate-900/80">{stripChase(log.reminderRule.name)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {partyLabel && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${partyPillClass}`}>
                Waiting on {partyLabel}
              </span>
            )}
            {log.reminderRule.targetMilestoneCode && (
              <span className="text-xs text-slate-900/30 font-mono">{log.reminderRule.targetMilestoneCode}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active header ──────────────────────────────────────────────────────────
  let borderColor = "";
  let headerBg = "bg-white/20 text-slate-900/50";
  let headerLeft: string;

  if (isEscalated) {
    borderColor = "border-red-300";
    headerBg = "bg-red-50/60 text-red-700";
    headerLeft = `Escalated${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : isDueToday ? " · due today" : ""}`;
  } else if (isOverdue) {
    borderColor = "border-orange-200";
    headerBg = "bg-orange-50/60 text-orange-600";
    headerLeft = `Overdue ${daysOverdue}d · follow-up ${(openTask?.chaseCount ?? 0) + 1}`;
  } else if (isDueToday) {
    borderColor = "border-amber-200";
    headerBg = "bg-amber-50/60 text-amber-600";
    headerLeft = "Due today";
  } else {
    headerLeft = `Due ${formatDate(log.nextDueDate)}`;
  }

  return (
    <div
      className={`glass-card${borderColor ? ` border ${borderColor}` : ""}`}
      style={{ clipPath: "inset(0 round 20px)" }}
    >
      {/* Status bar */}
      <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between ${headerBg}`}>
        <span>{headerLeft}</span>
        <span className="opacity-60">
          every {log.reminderRule.repeatEveryDays}d · escalates after {log.reminderRule.escalateAfterChases}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-3 space-y-2">
        {/* Property address link — hub page only */}
        {showAddressLink && (
          <Link
            href={`/agent/transactions/${transactionId}`}
            className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors block"
          >
            {propertyAddress} →
          </Link>
        )}

        {/* Title + party pill */}
        <div>
          <p className={`text-sm font-semibold leading-snug ${isEscalated ? "text-red-700" : "text-slate-900/90"}`}>
            {stripChase(log.reminderRule.name)}
          </p>
          {log.reminderRule.description && (
            <p className="text-xs text-slate-900/50 mt-0.5">{log.reminderRule.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {partyLabel && (
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${partyPillClass}`}>
                Waiting on {partyLabel}
              </span>
            )}
            {log.reminderRule.targetMilestoneCode && (
              <span className="text-xs text-slate-900/30 font-mono">{log.reminderRule.targetMilestoneCode}</span>
            )}
          </div>
        </div>

        {/* Chase history */}
        {openTask && (
          <p className="text-xs text-slate-900/40">
            {openTask.chaseCount === 0
              ? "No chases sent yet"
              : `${openTask.chaseCount} ${openTask.chaseCount === 1 ? "chase" : "chases"} sent${
                  lastComm
                    ? ` · Last chased ${relativeShort(lastComm.createdAt)}${methodLabel ? ` via ${methodLabel}` : ""}`
                    : ""
                }`
            }
          </p>
        )}

        {/* Actions */}
        {openTask && (
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <ChaseButton
              chaseTaskId={openTask.id}
              transactionId={transactionId}
              propertyAddress={propertyAddress}
              milestoneName={stripChase(log.reminderRule.name)}
              chaseCount={openTask.chaseCount}
              contacts={chaseContacts}
              onSent={() => onComplete(openTask.id)}
            />
            <button
              onClick={() => onComplete(openTask.id)}
              disabled={isLoading === openTask.id || isPending}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                isEscalated
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {isLoading === openTask.id ? "…" : "Mark done"}
            </button>
            <SnoozeDropdown
              taskId={openTask.id}
              onSnooze={onSnooze}
              disabled={isLoading === openTask.id || isPending}
            />
            {!isEscalated && (
              <button
                onClick={() => onEscalate(openTask.id)}
                disabled={isLoading === openTask.id || isPending}
                className="px-3 py-1.5 text-xs text-slate-900/35 hover:text-red-500 hover:bg-red-50/60 rounded-lg transition-colors disabled:opacity-40"
                title="Manually escalate this chase"
              >
                ↑ Escalate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
