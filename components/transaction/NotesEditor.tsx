"use client";

import { useState } from "react";

type Props = {
  transactionId: string;
  initialNotes: string | null;
};

export function NotesEditor({ transactionId, initialNotes }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.trim() || null }),
      });
      setSavedNotes(draft.trim() || null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="glass-section-label text-slate-900/40">Notes</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-slate-900/30 hover:text-blue-500 transition-colors"
          >
            {savedNotes ? "Edit" : "+ Add"}
          </button>
        )}
      </div>
      <div className="glass-card px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Add notes about this transaction…"
              className="glass-input w-full px-3 py-2.5 text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setDraft(savedNotes ?? ""); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : savedNotes ? (
          <p className="text-sm text-slate-900/80 whitespace-pre-wrap">{savedNotes}</p>
        ) : (
          <p className="text-sm text-slate-900/30 italic">No notes yet</p>
        )}
      </div>
    </section>
  );
}
