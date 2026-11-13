"use client";

// Director-only control on the file detail page. Renders as a small
// inline link "Reassign" next to (or below) the existing file-owner
// display. Click opens a modal with the AgentPicker; submitting calls
// reassignAgentAction, then revalidates the page so the new owner is
// visible everywhere immediately.
//
// The modal is PORTALLED to <body> so it can't be clipped by a transformed
// ancestor (the file hero sits inside filtered glass, which was cutting the
// fixed overlay off). Light scrim + blur, and it animates in and out.
//
// Mounted by the page server component only when the viewer is a
// director — caller controls visibility, this component does not
// re-check role (relies on the server action to enforce).

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [picked, setPicked] = useState<string>(currentAgentUserId ?? currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isUnchanged = picked === currentAgentUserId;

  function openModal() {
    setPicked(currentAgentUserId ?? currentUserId);
    setError(null);
    setClosing(false);
    setOpen(true);
  }

  function close() {
    if (isPending) return;
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 160);
  }

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPending]);

  function submit() {
    if (!picked) return; // guard: never reassign to nobody
    setError(null);
    startTransition(async () => {
      try {
        await reassignAgentAction(transactionId, picked);
        // The hero lives in the file LAYOUT; the action revalidates the page, not
        // the layout, so refresh the current route to update it without a reload.
        router.refresh();
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reassign");
      }
    });
  }

  const modal = open ? (
    <div
      className={`rao-backdrop${closing ? " rao-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Reassign file owner"
      onClick={close}
    >
      <div className="rao-card" onClick={(e) => e.stopPropagation()}>
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

        {error && <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: 0 }}>{error}</p>}

        <div className="rao-actions">
          <button
            type="button"
            onClick={close}
            disabled={isPending}
            className="agent-btn agent-btn-secondary"
            style={{ height: 34, padding: "0 14px", fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || isUnchanged || !picked}
            className="agent-btn agent-btn-primary"
            style={{ height: 34, padding: "0 14px", fontSize: 12, opacity: isUnchanged || !picked ? 0.5 : 1 }}
          >
            {isPending ? "Reassigning…" : "Reassign"}
          </button>
        </div>
      </div>

      <style>{`
        .rao-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(15, 23, 42, 0.14); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
          animation: rao-bd-in 150ms ease both; }
        .rao-backdrop.rao-closing { animation: rao-bd-out 150ms ease both; }
        .rao-card { width: 100%; max-width: 380px; background: var(--agent-surface-elevated); border: 0.5px solid var(--agent-border-default);
          border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
          animation: rao-card-in 200ms cubic-bezier(.2,.8,.2,1) both; }
        .rao-backdrop.rao-closing .rao-card { animation: rao-card-out 150ms ease both; }
        .rao-actions { display: flex; justify-content: flex-end; gap: 8px; }
        @keyframes rao-bd-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rao-bd-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes rao-card-in { from { opacity: 0; transform: translateY(10px) scale(0.97) } to { opacity: 1; transform: none } }
        @keyframes rao-card-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(8px) scale(0.98) } }
        @media (prefers-reduced-motion: reduce) {
          .rao-backdrop, .rao-card, .rao-backdrop.rao-closing, .rao-backdrop.rao-closing .rao-card { animation-duration: 1ms !important; }
        }
      `}</style>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="agent-link agent-link-muted"
        style={{ fontSize: 11, padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
        title="Change which agent owns this file"
      >
        Reassign
      </button>

      {typeof document !== "undefined" && modal && createPortal(modal, document.body)}
    </>
  );
}
