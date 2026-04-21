"use client";

import { useState } from "react";

export function AddManualTaskForm({
  transactionId,
  transactionAddress,
  onAdd,
}: {
  transactionId?: string;
  transactionAddress?: string;
  onAdd: (task: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      transactionId,
    });
    setTitle(""); setNotes(""); setDueDate("");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add to-do
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-blue-200 p-4 space-y-3"
      style={{ boxShadow: "0 1px 4px rgba(59,130,246,0.08)" }}
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
        className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 outline-none bg-transparent font-medium"
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full text-xs text-gray-500 placeholder-gray-300 border-0 outline-none bg-transparent resize-none"
      />
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs text-gray-500 border-0 outline-none bg-transparent"
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(""); setNotes(""); setDueDate(""); }}
          className="text-xs text-gray-400 hover:text-gray-600"
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
