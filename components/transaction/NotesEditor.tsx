"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  transactionId: string;
  initialNotes: string | null;
};

export function NotesEditor({ transactionId, initialNotes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.trim() || null }),
      });
      router.refresh();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-300 hover:text-blue-500 transition-colors"
          >
            {initialNotes ? "Edit" : "+ Add"}
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl border border-[#e4e9f0] px-5 py-4"
           style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Add notes about this transaction…"
              className="w-full px-3 py-2.5 text-sm border border-[#e4e9f0] rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
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
                onClick={() => { setDraft(initialNotes ?? ""); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : initialNotes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{initialNotes}</p>
        ) : (
          <p className="text-sm text-gray-300 italic">No notes yet</p>
        )}
      </div>
    </section>
  );
}
