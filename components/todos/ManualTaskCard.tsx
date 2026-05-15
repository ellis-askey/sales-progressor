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
  isNew,
}: {
  task: ManualTaskWithRelations;
  onToggle: (id: string, status: "open" | "done") => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progressorNote, setProgressorNote] = useState(task.progressorNote ?? "");
  const [exiting, setExiting] = useState(false);
  const [rowFlash, setRowFlash] = useState(false);
  const [checkPopped, setCheckPopped] = useState(false);
  const isDone = task.status === "done";

  async function handleProgressorNoteBlur() {
    const trimmed = progressorNote.trim();
    const current = task.progressorNote ?? "";
    if (trimmed === current) return;
    const res = await fetch(`/api/manual-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressorNote: trimmed || null }),
    });
    if (res.ok) {
      setRowFlash(true);
      setTimeout(() => setRowFlash(false), 700);
    }
  }

  async function handleToggle() {
    setBusy(true);
    const completing = !isDone;
    if (completing) {
      setRowFlash(true);
      setCheckPopped(true);
      setTimeout(() => setRowFlash(false), 700);
      setTimeout(() => setCheckPopped(false), 360);
    }
    await onToggle(task.id, completing ? "done" : "open");
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    setExiting(true);
    setTimeout(() => onDelete(task.id), 150);
  }

  const due = task.dueDate ? formatDue(task.dueDate) : null;

  return (
    <div
      className={`px-4 py-2.5 flex items-start gap-3 transition-opacity ${isDone ? "opacity-60" : ""} ${isNew ? "agent-reveal-in" : ""} ${rowFlash ? "agent-row-flash" : ""} ${exiting ? "agent-row-exit" : ""}`}
      style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
    >
      {/* Native checkbox — coral accent, ms-pop wrapper for completion bounce */}
      <div className={checkPopped ? "ms-pop" : ""} style={{ flexShrink: 0, marginTop: 2 }}>
        <input
          type="checkbox"
          checked={isDone}
          onChange={handleToggle}
          disabled={busy}
          style={{
            width: 14, height: 14,
            accentColor: "var(--agent-coral)",
            cursor: busy ? "wait" : "pointer",
            display: "block",
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            color: isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
            textDecoration: isDone ? "line-through" : "none",
            lineHeight: 1.4,
          }}>
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
          <div className="mt-1.5 space-y-0.5">
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {task.createdBy.name} · {timeAgo(task.createdAt)}
            </p>
            <p style={{ fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{task.notes}</p>
          </div>
        )}

        {/* Progressor response (editable inline) */}
        <div className="mt-1.5">
          {task.progressorNote && (
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Your response · {task.progressorNoteAt ? timeAgo(task.progressorNoteAt) : ""}
            </p>
          )}
          <input
            type="text"
            value={progressorNote}
            onChange={(e) => setProgressorNote(e.target.value)}
            onBlur={handleProgressorNoteBlur}
            placeholder={task.isAgentRequest ? "Add a response…" : "Add a note…"}
            className="w-full text-xs bg-transparent border-b border-dashed focus:outline-none placeholder-slate-300 py-0.5 leading-relaxed"
            style={{ borderColor: "var(--agent-border-default)", color: "var(--agent-text-secondary)" }}
          />
        </div>

        {/* Due date / transaction link */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.transaction && (
            <Link
              href={`/transactions/${task.transactionId}`}
              className="text-xs text-blue-500 hover:text-blue-600 truncate max-w-[200px]"
            >
              {task.transaction.propertyAddress}
            </Link>
          )}
          {task.assignedTo && (
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{task.assignedTo.name}</span>
          )}
          {due && (
            <span style={{ fontSize: 11, fontWeight: 500, color: due.overdue ? "#ef4444" : "var(--agent-text-muted)" }}>
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="agent-icon-btn agent-icon-btn-sm flex-shrink-0"
        style={{ marginTop: 1 }}
      >
        ×
      </button>
    </div>
  );
}
