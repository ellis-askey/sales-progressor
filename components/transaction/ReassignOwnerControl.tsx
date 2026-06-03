"use client";

// Director-only control on the file detail page. Renders as a small
// inline link "Reassign" next to (or below) the existing file-owner
// display. Click opens a modal with the AgentPicker; submitting calls
// reassignAgentAction, then revalidates the page so the new owner is
// visible everywhere immediately.
//
// Mounted by the page server component only when the viewer is a
// director — caller controls visibility, this component does not
// re-check role (relies on the server action to enforce).

import { useState, useTransition } from "react";
import { AgentPicker } from "@/components/agent-picker/AgentPicker";
import { reassignAgentAction } from "@/app/actions/transactions";
import type { AssignableAgent } from "@/lib/services/agency-team";

type Props = {
  transactionId: string;
  currentAgentUserId: string | null;
  currentAgentName: string | null;
  currentUserId: string;
  assignableAgents: AssignableAgent[];
};

export function ReassignOwnerControl({
  transactionId,
  currentAgentUserId,
  currentAgentName,
  currentUserId,
  assignableAgents,
}: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(currentAgentUserId ?? currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isUnchanged = picked === currentAgentUserId;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await reassignAgentAction(transactionId, picked);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reassign");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setPicked(currentAgentUserId ?? currentUserId); setError(null); setOpen(true); }}
        className="agent-link agent-link-muted"
        style={{ fontSize: 11, padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
        title="Change which agent owns this file"
      >
        Reassign
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !isPending && setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 380,
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid var(--agent-border-default)",
              borderRadius: 14,
              padding: 20,
              display: "flex", flexDirection: "column", gap: 14,
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                Reassign file owner
              </h3>
              <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "4px 0 0" }}>
                Currently owned by {currentAgentName ?? "no one"}. Pick a new owner from your agency.
              </p>
            </div>

            <AgentPicker
              value={picked}
              onChange={setPicked}
              agents={assignableAgents}
              currentUserId={currentUserId}
              label="New owner"
            />

            {error && (
              <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: 0 }}>{error}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => !isPending && setOpen(false)}
                disabled={isPending}
                className="agent-btn agent-btn-secondary"
                style={{ height: 34, padding: "0 14px", fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || isUnchanged}
                className="agent-btn agent-btn-primary"
                style={{ height: 34, padding: "0 14px", fontSize: 12, opacity: isUnchanged ? 0.5 : 1 }}
              >
                {isPending ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
