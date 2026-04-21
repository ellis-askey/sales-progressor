"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { relativeDate } from "@/lib/utils";

type Note = {
  id: string;
  content: string;
  createdAt: Date | string;
  createdBy: { id: string; name: string } | null;
};

type Props = {
  transactionId: string;
  initialNotes: Note[];
};

const PAGE_SIZE = 5;

export function TransactionNotes({ transactionId, initialNotes }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = expanded ? initialNotes : initialNotes.slice(0, PAGE_SIZE);
  const hidden = initialNotes.length - PAGE_SIZE;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transaction-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, content: draft.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDraft("");
      router.refresh();
    } catch {
      setError("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/transaction-notes?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes</h2>

      {/* Add note form */}
      <form onSubmit={handleAdd} className="mb-4">
        <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
             style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none border-b border-[#f0f4f8]"
          />
          <div className="px-4 py-2.5 flex items-center justify-between">
            {error ? (
              <span className="text-xs text-red-500">{error}</span>
            ) : (
              <span className="text-xs text-gray-300">Shift+Enter for new line</span>
            )}
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      </form>

      {/* Note list */}
      {initialNotes.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((note) => {
            const initials = note.createdBy?.name
              ? note.createdBy.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
              : "?";
            return (
              <div
                key={note.id}
                className="group bg-white rounded-xl border border-[#e4e9f0] px-4 py-3.5 flex items-start gap-3"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                {/* Author avatar */}
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      {note.createdBy?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-gray-300">{relativeDate(note.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={deleting === note.id}
                  className="flex-shrink-0 text-xs text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 mt-0.5"
                >
                  {deleting === note.id ? "…" : "Delete"}
                </button>
              </div>
            );
          })}

          {!expanded && hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 text-center transition-colors"
            >
              Show {hidden} more note{hidden !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {initialNotes.length === 0 && (
        <p className="text-sm text-gray-300 italic px-1">No notes yet</p>
      )}
    </section>
  );
}
