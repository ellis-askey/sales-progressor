"use client";

import { useState, useTransition, useOptimistic } from "react";
import { relativeDate } from "@/lib/utils";
import { addNoteAction, deleteCommAction } from "@/app/actions/comms";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Note = {
  id: string;
  content: string;
  createdAt: Date | string;
  createdByName: string | null;
};

type Props = {
  transactionId: string;
  initialNotes: Note[];
  currentUserName: string;
};

const PAGE_SIZE = 5;

export function TransactionNotes({ transactionId, initialNotes, currentUserName }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [optimisticNotes, addOptimisticNote] = useOptimistic(
    initialNotes,
    (current: Note[], newNote: Note) => [newNote, ...current]
  );

  const visible = expanded ? optimisticNotes : optimisticNotes.slice(0, PAGE_SIZE);
  const hidden = optimisticNotes.length - PAGE_SIZE;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    setError(null);

    startTransition(async () => {
      addOptimisticNote({
        id: `temp-${Date.now()}`,
        content,
        createdAt: new Date(),
        createdByName: currentUserName,
      });
      try {
        await addNoteAction(transactionId, content);
        toast.success("Note added");
      } catch {
        setError("Failed to save note — please try again");
      }
    });
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteCommAction(id, transactionId);
      } finally {
        setDeleting(null);
      }
    });
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">Notes</h2>

      {/* Add note form */}
      <form onSubmit={handleAdd} className="mb-4">
        <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full px-4 py-3 text-sm text-slate-900/80 placeholder:text-slate-900/30 resize-none focus:outline-none border-b border-white/20 bg-transparent"
          />
          <div className="px-4 py-2.5 flex items-center justify-between">
            {error && (
              <span className="text-xs text-red-500">{error}</span>
            )}
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              className="px-3 py-1.5 text-xs font-medium agent-btn-color-primary rounded-lg transition-colors disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      </form>

      {/* Note list */}
      {optimisticNotes.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((note) => {
            const initials = note.createdByName
              ? note.createdByName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
              : "?";
            const isOptimistic = note.id.startsWith("temp-");
            return (
              <div
                key={note.id}
                className="group glass-card px-4 py-3.5 flex items-start gap-3"
                style={isOptimistic ? { opacity: 0.65 } : undefined}
              >
                <div className="w-7 h-7 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-900/70">{note.createdByName}</span>
                    <span className="text-xs text-slate-900/30">
                      {isOptimistic ? "just now" : relativeDate(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900/80 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
                {!isOptimistic && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deleting === note.id || isPending}
                    className="flex-shrink-0 text-xs text-slate-900/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 mt-0.5"
                  >
                    {deleting === note.id ? "…" : "Delete"}
                  </button>
                )}
              </div>
            );
          })}

          {!expanded && hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-xs py-2 text-center agent-link-muted"
            >
              Show {hidden} more note{hidden !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {optimisticNotes.length === 0 && (
        <p className="text-sm text-slate-900/30 italic px-1">No notes yet</p>
      )}
    </section>
  );
}
