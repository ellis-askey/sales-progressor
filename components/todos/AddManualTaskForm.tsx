"use client";

import { useState } from "react";

export function AddManualTaskForm({
  transactionId,
  transactionAddress,
  showOwnership = false,
  internalMode = false,
  onAdd,
}: {
  transactionId?: string;
  transactionAddress?: string;
  showOwnership?: boolean;
  // Internal-staff variant — hides the ownership toggle, relabels the
  // primary button, and the caller is responsible for setting
  // isInternalSelfAssigned on the POST.
  internalMode?: boolean;
  onAdd: (task: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [owner, setOwner] = useState<"mine" | "progressor">("mine");
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState("");

  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayStr() {
    return localDateStr(new Date());
  }

  function handleOpen() {
    const now = new Date();
    if (now.getHours() >= 15) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setDueDate(localDateStr(tomorrow));
    } else {
      setDueDate(todayStr());
    }
    setDateError("");
    setOpen(true);
  }

  function handleCancel() {
    setOpen(false);
    setTitle("");
    setNotes("");
    setDueDate("");
    setOwner("mine");
    setDateError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // Client-side past-date guard (min attr handles it for most browsers, this is the fallback)
    if (dueDate && dueDate < todayStr()) {
      setDateError("Due date cannot be in the past.");
      return;
    }
    setDateError("");

    setSaving(true);
    await onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      transactionId,
      isAgentRequest: showOwnership && owner === "progressor",
    });
    setTitle(""); setNotes(""); setDueDate(""); setOwner("mine");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={handleOpen} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {internalMode ? "Add internal to-do" : "Add to-do"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-4 space-y-3 agent-reveal-in"
    >
      {transactionAddress && (
        <p className="text-xs text-blue-500 font-medium truncate">{transactionAddress}</p>
      )}
      <input
        autoFocus
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full text-base text-slate-900/80 placeholder:text-slate-900/30 border-0 outline-none bg-transparent font-medium"
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full text-base text-slate-900/50 placeholder:text-slate-900/30 border-0 outline-none bg-transparent resize-none"
      />
      {showOwnership && (
        <div>
          <p className="text-xs text-slate-900/40 mb-1.5">Who&apos;s responsible?</p>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => setOwner("mine")}
              className={`agent-segment-pill agent-segment-pill-sm${owner === "mine" ? " on" : ""}`}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setOwner("progressor")}
              className={`agent-segment-pill agent-segment-pill-sm${owner === "progressor" ? " on" : ""}`}
            >
              Your progressor
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 pt-1" style={{ borderTop: "0.5px solid var(--agent-border-subtle)" }}>
        <div>
          <input
            type="date"
            value={dueDate}
            min={todayStr()}
            onChange={(e) => { setDueDate(e.target.value); setDateError(""); }}
            className="text-base text-slate-900/50 border-0 outline-none bg-transparent"
          />
          {dateError && <p className="text-xs text-red-500 mt-0.5">{dateError}</p>}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={handleCancel} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
          Cancel
        </button>
        <button type="submit" disabled={saving || !title.trim()} className="agent-btn agent-btn-sm agent-btn-primary">
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </form>
  );
}
