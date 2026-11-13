"use client";

// In-house progression: a small "Set / change progressor" link on a self-managed
// file. Opens a modal to pick the in-house progressor (from the agency's pool) or
// unassign. Submitting calls assignUserAction, which writes assignedUserId +
// assignedAt and logs the change. Shown only by the file page when the agency has
// inHouseProgressionEnabled; this component relies on the server action to enforce.
// See docs/active/in-house-progression/00-spec.md.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignUserAction } from "@/app/actions/transactions";
import type { AssignableAgent } from "@/lib/services/agency-team";

type Props = {
  transactionId: string;
  currentAssignedUserId: string | null;
  currentAssignedName: string | null;
  progressors: AssignableAgent[];
};

export function AssignProgressorControl({
  transactionId,
  currentAssignedUserId,
  currentAssignedName,
  progressors,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(currentAssignedUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isUnchanged = (picked || null) === currentAssignedUserId;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await assignUserAction(transactionId, picked || null);
        // The hero lives in the file LAYOUT; revalidateTx targets the page, not
        // the layout, so refresh the current route to update it without a reload.
        router.refresh();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the progressor");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setPicked(currentAssignedUserId ?? ""); setError(null); setOpen(true); }}
        className="agent-link agent-link-muted"
        style={{ fontSize: 11, padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
        title="Set or change the in-house progressor on this file"
      >
        {currentAssignedUserId ? "Change progressor" : "Set progressor"}
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
                {currentAssignedUserId ? "Change progressor" : "Set progressor"}
              </h3>
              <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "4px 0 0" }}>
                {currentAssignedName ? `Currently with ${currentAssignedName}.` : "No progressor assigned yet."} Pick who progresses this sale.
              </p>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Progressor</span>
              <select
                className="agent-input"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
              >
                <option value="">Unassigned</option>
                {progressors.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

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
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
