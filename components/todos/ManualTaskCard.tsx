"use client";

import { useState } from "react";
import Link from "next/link";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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
  const [progressorNote, setProgressorNote] = useState(task.progressorNote ?? "");
  const isDone = task.status === "done";

  async function handleProgressorNoteBlur() {
    const trimmed = progressorNote.trim();
    const current = task.progressorNote ?? "";
    if (trimmed === current) return;
    await fetch(`/api/manual-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressorNote: trimmed || null }),
    });
  }

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

        {/* Agent's creation note (read-only) */}
        {task.notes && (
          <div className="mt-2 space-y-0.5">
            <p className="text-[10px] font-medium text-slate-900/35 uppercase tracking-wide">
              {task.createdBy.name} · {timeAgo(task.createdAt)}
            </p>
            <p className="text-xs text-slate-900/50 leading-relaxed">{task.notes}</p>
          </div>
        )}

        {/* Progressor response (editable) */}
        <div className="mt-2">
          {task.progressorNote && (
            <p className="text-[10px] font-medium text-slate-900/35 uppercase tracking-wide mb-0.5">
              Your response · {task.progressorNoteAt ? timeAgo(task.progressorNoteAt) : ""}
            </p>
          )}
          <input
            type="text"
            value={progressorNote}
            onChange={(e) => setProgressorNote(e.target.value)}
            onBlur={handleProgressorNoteBlur}
            placeholder={task.isAgentRequest ? "Add a response…" : "Add a note…"}
            className="w-full text-xs text-slate-900/50 bg-transparent border-b border-dashed border-slate-200/70 focus:border-blue-300/70 focus:outline-none placeholder-slate-300 py-0.5 leading-relaxed"
          />
        </div>

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
