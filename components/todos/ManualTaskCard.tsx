"use client";

import { useState } from "react";
import Link from "next/link";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function formatDue(date: Date) {
  const d = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Due today", overdue: false };
  if (diff === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, overdue: false };
}

export function ManualTaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: ManualTaskWithRelations;
  onToggle: (id: string, status: "open" | "done") => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isDone = task.status === "done";

  async function handleToggle() {
    setBusy(true);
    await onToggle(task.id, isDone ? "open" : "done");
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    onDelete(task.id);
  }

  const due = task.dueDate ? formatDue(task.dueDate) : null;

  return (
    <div className={`glass-card px-4 py-3.5 flex items-start gap-3 transition-opacity ${isDone ? "opacity-60" : ""}`}>

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isDone ? "bg-emerald-500 border-emerald-500" : "border-white/40 hover:border-blue-400"
        }`}
      >
        {isDone && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-sm font-medium text-slate-900/80 leading-snug ${isDone ? "line-through text-slate-900/40" : ""}`}>
            {task.title}
          </p>
          {task.isAgentRequest && (
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-700">
              From agent
            </span>
          )}
        </div>
        {task.notes && (
          <p className="text-xs text-slate-900/40 mt-0.5 leading-relaxed">{task.notes}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {task.transaction && (
            <Link
              href={`/transactions/${task.transactionId}`}
              className="text-xs text-blue-500 hover:text-blue-600 truncate max-w-[200px]"
            >
              {task.transaction.propertyAddress}
            </Link>
          )}
          {task.assignedTo && (
            <span className="text-xs text-slate-900/40">{task.assignedTo.name}</span>
          )}
          {due && (
            <span className={`text-xs font-medium ${due.overdue ? "text-red-500" : "text-slate-900/40"}`}>
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="text-slate-900/30 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
