"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ChaseButton } from "@/components/chase/ChaseButton";

function stripChase(name: string): string {
  return name.replace(/^Chase:\s*/i, "");
}

type Contact = {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
};

const SNOOZE_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
  { label: "7 days",   hours: 168 },
  { label: "14 days",  hours: 336 },
];

type Props = {
  task: {
    id: string;
    status: string;
    priority: string;
    chaseCount: number;
    dueDate: Date;
    transaction: {
      id: string;
      propertyAddress: string;
      assignedUserId: string | null;
      assignedUser: { id: string; name: string } | null;
      contacts: Contact[];
    };
    reminderLog: {
      reminderRule: {
        name: string;
        targetMilestoneCode: string | null;
        repeatEveryDays: number;
        escalateAfterChases: number;
      };
    };
    assignedTo: { id: string; name: string } | null;
  };
  onAction: (taskId: string, action: "complete" | "snooze", snoozeHours?: number) => void;
  onChased: () => void;
  loading: boolean;
};

function SnoozeButton({ taskId, onSnooze, disabled }: {
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
      <button onClick={() => setOpen((p) => !p)} disabled={disabled}
        className="px-3 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/40 transition-colors disabled:opacity-40">
        Snooze
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 glass-card-strong min-w-[130px]">
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.hours} onClick={() => { onSnooze(taskId, opt.hours); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-slate-900/70 hover:bg-white/40 transition-colors">
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskCard({ task, onAction, onChased, loading }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(task.dueDate);
  const isOverdue = dueDate < today;
  const isDueToday = dueDate.toDateString() === today.toDateString();
  const isEscalated = task.priority === "escalated";

  const addressParts = task.transaction.propertyAddress.split(",");
  const addressLine1 = addressParts[0].trim();
  const addressLine2 = addressParts.slice(1).join(",").trim();

  let borderLeft = "border-l-blue-300";
  let dueBadgeBg = "bg-white/30 text-slate-900/50";
  let dueBadgeText = formatDate(task.dueDate);

  if (isEscalated) {
    borderLeft = "border-l-red-400";
    dueBadgeBg = "bg-red-100/80 text-red-700";
    dueBadgeText = `⬆ Escalated · ${task.chaseCount} chases`;
  } else if (isOverdue) {
    borderLeft = "border-l-orange-400";
    dueBadgeBg = "bg-orange-100/80 text-orange-700";
    dueBadgeText = `Overdue · due ${formatDate(task.dueDate)}`;
  } else if (isDueToday) {
    borderLeft = "border-l-amber-400";
    dueBadgeBg = "bg-amber-100/80 text-amber-700";
    dueBadgeText = "Due today";
  }

  return (
    <div className={`glass-card border-l-4 ${borderLeft} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="px-5 py-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <Link
              href={`/transactions/${task.transaction.id}`}
              className="text-sm font-semibold text-slate-900/90 hover:text-blue-600 transition-colors leading-tight block truncate"
            >
              {addressLine1}
            </Link>
            {addressLine2 && (
              <p className="text-xs text-slate-900/40 truncate mt-0.5">{addressLine2}</p>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${dueBadgeBg}`}>
            {dueBadgeText}
          </span>
        </div>

        {/* Task description */}
        <p className={`text-sm ${isEscalated ? "text-red-700 font-medium" : "text-slate-900/70"} mb-1`}>
          {stripChase(task.reminderLog.reminderRule.name)}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2">
          {task.reminderLog.reminderRule.targetMilestoneCode && (
            <span className="text-xs text-slate-900/40 font-mono bg-white/30 border border-white/30 px-1.5 py-0.5 rounded">
              {task.reminderLog.reminderRule.targetMilestoneCode}
            </span>
          )}
          {task.assignedTo && (
            <span className="text-xs text-slate-900/40">{task.assignedTo.name}</span>
          )}
          {task.chaseCount > 0 && (
            <span className="text-xs text-slate-900/40">
              Chase {task.chaseCount + 1} of {task.reminderLog.reminderRule.escalateAfterChases}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
          <ChaseButton
            chaseTaskId={task.id}
            transactionId={task.transaction.id}
            propertyAddress={task.transaction.propertyAddress}
            milestoneName={stripChase(task.reminderLog.reminderRule.name)}
            chaseCount={task.chaseCount}
            contacts={task.transaction.contacts}
            onSent={onChased}
          />

          <button
            onClick={() => onAction(task.id, "complete")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 border border-slate-900/20 text-slate-900/70 hover:bg-white/50 hover:border-slate-900/30 hover:text-slate-900/90"
          >
            {loading ? "…" : "Mark done"}
          </button>
          <SnoozeButton taskId={task.id} onSnooze={(id, hours) => onAction(id, "snooze", hours)} disabled={loading} />
          <Link
            href={`/transactions/${task.transaction.id}`}
            className="ml-auto text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            View file →
          </Link>
        </div>
      </div>
    </div>
  );
}
