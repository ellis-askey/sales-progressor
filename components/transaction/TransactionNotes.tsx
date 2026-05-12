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
    <div className="glass-card overflow-hidden rounded-[12px]">
      <div className="agent-card-hdr">
        <h3 className="agent-card-title">Notes</h3>
      </div>

      <div style={{ padding: 16 }}>
        {/* Note list */}
        {optimisticNotes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {visible.map((note) => {
              const isOptimistic = note.id.startsWith("temp-");
              return (
                <div key={note.id} className={isOptimistic ? "agent-reveal-in" : ""}>
                <div
                  style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: 8,
                    border: "0.5px solid var(--agent-border-default)",
                    position: "relative",
                    opacity: isOptimistic ? 0.65 : 1,
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.72)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.5)"; }}
                >
                  <p style={{ fontSize: 12, color: "var(--agent-text-primary)", marginRight: 24 }}>
                    {note.content}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>
                    {note.createdByName ? `${note.createdByName} · ` : ""}
                    {isOptimistic ? "just now" : relativeDate(note.createdAt)}
                  </p>
                  {!isOptimistic && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deleting === note.id || isPending}
                      className="agent-icon-btn agent-icon-btn-sm"
                      style={{ position: "absolute", top: 6, right: 6, opacity: 0.35 }}
                      onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                      onFocus={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseOut={(e) => (e.currentTarget.style.opacity = "0.35")}
                      onBlur={(e) => (e.currentTarget.style.opacity = "0.35")}
                      aria-label="Delete note"
                    >
                      {deleting === note.id ? "…" : "×"}
                    </button>
                  )}
                </div>
                </div>
              );
            })}

            {!expanded && hidden > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs py-1 text-center agent-link-muted"
              >
                Show {hidden} more note{hidden !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            className="agent-textarea"
            style={{ flex: 1, minHeight: 60, resize: "none", fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={isPending || !draft.trim()}
            className="agent-btn agent-btn-sm agent-btn-primary"
            style={{ alignSelf: "flex-end" }}
          >
            {isPending ? "Saving…" : "Add note"}
          </button>
        </form>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
