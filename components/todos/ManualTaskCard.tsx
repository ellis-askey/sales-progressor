"use client";

import { useState, useEffect } from "react";
import { Popover } from "@/components/ui/Popover";
import Link from "next/link";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";
import { updateManualTaskAction } from "@/app/actions/manual-tasks";
import { Pill } from "@/components/ui/Pill";
import { toUKDateStr } from "@/lib/utils";

// Date-only value for an <input type="date"> — UTC components so a stored
// midnight-UTC due date doesn't slip a day in a behind-UTC timezone.
function toInputDate(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

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
  const todayStr = toUKDateStr(new Date());
  const dueStr = toUKDateStr(d);
  const diff = Math.round((new Date(dueStr).getTime() - new Date(todayStr).getTime()) / 86400000);
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
  readOnly = false,
}: {
  task: ManualTaskWithRelations;
  onToggle: (id: string, status: "open" | "done") => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
  readOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progressorNote, setProgressorNote] = useState(task.progressorNote ?? "");
  const [exiting, setExiting] = useState(false);
  const [rowFlash, setRowFlash] = useState(false);
  const [checkPopped, setCheckPopped] = useState(false);
  const isDone = task.status === "done";

  // Reschedule popover (critique #274): add an update + pick a new date in one
  // step. localDue drives the display so the new date shows without a refresh.
  const [localDue, setLocalDue] = useState<Date | null>(task.dueDate ?? null);
  const [newDate, setNewDate] = useState(toInputDate(task.dueDate ?? null));
  const [updateText, setUpdateText] = useState(task.progressorNote ?? "");
  const [savingResched, setSavingResched] = useState(false);

  // Keep local copies in step if the parent hands us a fresher task.
  useEffect(() => { setLocalDue(task.dueDate ?? null); }, [task.dueDate]);

  // Seed the fields when the Popover trigger opens.
  function openResched() {
    setNewDate(toInputDate(localDue));
    setUpdateText(progressorNote);
  }

  async function saveResched(): Promise<boolean> {
    if (!newDate) return false;
    setSavingResched(true);
    const nextNote = updateText.trim();
    const noteChanged = nextNote !== (task.progressorNote ?? "");
    try {
      await updateManualTaskAction(task.id, {
        dueDate: newDate,
        ...(noteChanged ? { progressorNote: nextNote || null } : {}),
      });
      // Reflect immediately (UTC midnight to match the stored date-only value).
      setLocalDue(new Date(`${newDate}T00:00:00.000Z`));
      if (noteChanged) setProgressorNote(nextNote);
      setRowFlash(true);
      setTimeout(() => setRowFlash(false), 700);
      return true;
    } catch {
      // Leave the popover open so the agent can retry.
      return false;
    } finally {
      setSavingResched(false);
    }
  }

  async function handleProgressorNoteBlur() {
    const trimmed = progressorNote.trim();
    const current = task.progressorNote ?? "";
    if (trimmed === current) return;
    try {
      await updateManualTaskAction(task.id, { progressorNote: trimmed || null });
      setRowFlash(true);
      setTimeout(() => setRowFlash(false), 700);
    } catch {
      // No flash on failure — matches the previous res.ok gate.
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

  const due = localDue ? formatDue(localDue) : null;

  return (
    <div
      className={`px-4 py-2.5 flex items-start gap-3 transition-opacity ${isDone ? "opacity-60" : ""} ${isNew ? "agent-reveal-in" : ""} ${rowFlash ? "agent-row-flash" : ""} ${exiting ? "agent-row-exit" : ""}`}
      style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
    >
      {/* Native checkbox — coral accent, ms-pop wrapper for completion bounce */}
      {!readOnly && (
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
      )}

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
            <Pill glass tone="brand" size="sm" className="flex-shrink-0">From agent</Pill>
          )}
          {task.isReview && (
            <Pill glass tone="warning" size="sm" className="flex-shrink-0">Review</Pill>
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

        {/* Progressor response (editable inline, hidden when read-only) */}
        {!readOnly && (
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
        )}

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
          {/* Due date — click to add an update + reschedule in one step (#274).
              Read-only lists keep the plain label. */}
          {readOnly ? (
            due && (
              <span style={{ fontSize: 11, fontWeight: 500, color: due.overdue ? "#ef4444" : "var(--agent-text-muted)" }}>
                {due.label}
              </span>
            )
          ) : (
            <Popover
              preset="popover"
              width={230}
              placement="bottom-start"
              trigger={
                <button
                  type="button"
                  onClick={openResched}
                  className="agent-link"
                  style={{ fontSize: 11, fontWeight: 500, color: due ? (due.overdue ? "#ef4444" : "var(--agent-text-muted)") : "var(--agent-coral-deep)", cursor: "pointer", background: "none", border: 0, padding: 0 }}
                >
                  {due ? due.label : "+ Add date"}
                </button>
              }
            >
              {(close) => (
                <div style={{ textAlign: "left" }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", marginBottom: 5 }}>
                    New date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="agent-focus w-full text-xs rounded-lg px-2.5 py-2"
                    style={{ border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass, #fff)", color: "var(--agent-text-primary)" }}
                  />
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", margin: "10px 0 5px" }}>
                    Update <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <textarea
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="What's happened?"
                    rows={2}
                    className="agent-focus w-full text-xs rounded-lg px-2.5 py-2 leading-relaxed"
                    style={{ border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass, #fff)", color: "var(--agent-text-secondary)", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
                    <button type="button" onClick={close} className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
                    <button
                      type="button"
                      onClick={async () => { if (await saveResched()) close(); }}
                      disabled={!newDate || savingResched}
                      className="agent-btn agent-btn-primary agent-btn-sm"
                    >
                      {savingResched ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </Popover>
          )}
        </div>
      </div>

      {/* Delete */}
      {!readOnly && (
        <button
          onClick={handleDelete}
          className="agent-icon-btn agent-icon-btn-sm flex-shrink-0"
          style={{ marginTop: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
