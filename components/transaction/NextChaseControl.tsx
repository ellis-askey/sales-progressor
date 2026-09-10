"use client";

// Per-thread "Next email" control on the Chase timeline (chase-consolidation
// D2/D3): view/edit the upcoming chase, or skip the next send. The email itself
// (a true-to-inbox preview + the edit fields) opens in a right-side drawer —
// the timeline details column is too narrow for a 560px email — so this inline
// control holds only the status + the quick actions. Edits write a
// ChaseEmailOverride the cron build honours at fire time. See
// docs/active/chase-consolidation/00-spec.md.

import { useState, useTransition } from "react";
import { PencilSimple, Prohibit, ArrowCounterClockwise } from "@phosphor-icons/react";
import { skipChaseThreadAction, clearChaseThreadAction } from "@/app/actions/chase-timeline";
import { NextChaseEmailDrawer } from "@/components/transaction/NextChaseEmailDrawer";

type OverrideTarget =
  | { kind: "client"; contactId: string; milestoneCode: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser"; milestoneCode: string };

export function NextChaseControl({
  transactionId,
  target,
  edited,
  skipped,
}: {
  transactionId: string;
  target: OverrideTarget;
  edited: boolean;
  skipped: boolean;
}) {
  const [pending, start] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The action target drops milestoneCode into a separate arg.
  const actionTarget =
    target.kind === "client"
      ? ({ kind: "client", contactId: target.contactId } as const)
      : ({ kind: "solicitor", side: target.side } as const);
  const base = { transactionId, target: actionTarget, milestoneCode: target.milestoneCode };

  function toggleSkip() {
    start(async () => { await skipChaseThreadAction({ ...base, skip: !skipped }); });
  }
  function reset() {
    start(async () => { await clearChaseThreadAction(base); });
  }

  const statusLabel = skipped ? "Next send skipped" : edited ? "Edited copy staged" : "Standard reminder";
  const statusTone = skipped ? "var(--agent-warning)" : edited ? "var(--agent-coral-deep)" : "var(--agent-text-muted)";

  return (
    <div style={{ marginTop: 4, borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: 8 }}>
        Next email
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: statusTone, fontWeight: 600 }}>{statusLabel}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={() => setDrawerOpen(true)} disabled={pending} className="agent-btn agent-btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px", gap: 6 }}>
          <PencilSimple size={13} weight="bold" aria-hidden /> View / edit
        </button>
        <button type="button" onClick={toggleSkip} disabled={pending} className="agent-btn agent-btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px", gap: 6 }}>
          <Prohibit size={13} weight="bold" aria-hidden /> {skipped ? "Don't skip" : "Skip next send"}
        </button>
        {(edited || skipped) && (
          <button type="button" onClick={reset} disabled={pending} className="agent-btn agent-btn-ghost" style={{ fontSize: 12.5, padding: "7px 10px", gap: 6 }}>
            <ArrowCounterClockwise size={13} weight="bold" aria-hidden /> Reset
          </button>
        )}
      </div>

      <NextChaseEmailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transactionId={transactionId}
        target={target}
        edited={edited}
      />
    </div>
  );
}
