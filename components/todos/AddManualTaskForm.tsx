"use client";

import { useState } from "react";

export function AddManualTaskForm({
  transactionId,
  transactionAddress,
  showOwnership = false,
  onAdd,
}: {
  transactionId?: string;
  transactionAddress?: string;
  showOwnership?: boolean;
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
      <button
        onClick={handleOpen}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 600,
          padding: "7px 14px", borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.12)",
          background: "rgba(255,255,255,0.60)",
          color: "rgba(15,23,42,0.55)",
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add to-do
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card border border-blue-200/60 p-4 space-y-3"
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
          <div className="inline-flex items-center gap-0.5 bg-white/40 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setOwner("mine")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                owner === "mine"
                  ? "bg-white shadow-sm text-slate-900/80"
                  : "text-slate-900/40 hover:text-slate-900/60"
              }`}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setOwner("progressor")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                owner === "progressor"
                  ? "bg-white shadow-sm text-amber-700"
                  : "text-slate-900/40 hover:text-slate-900/60"
              }`}
            >
              Sales Progressor
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 pt-1 border-t border-white/20">
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
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-slate-900/40 hover:text-slate-900/70"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-xs font-medium text-white transition-colors"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </form>
  );
}
