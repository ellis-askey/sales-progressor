"use client";

// Per-thread "Next email" control on the Chase timeline (chase-consolidation
// D2/D3): preview the upcoming chase, edit its copy, or skip the next send.
// Writes a ChaseEmailOverride via the timeline actions; the cron build honours
// it at fire time. See docs/active/chase-consolidation/00-spec.md.

import { useState, useTransition } from "react";
import { PencilSimple, Prohibit, ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  editChaseThreadAction,
  skipChaseThreadAction,
  clearChaseThreadAction,
  previewChaseEmailAction,
} from "@/app/actions/chase-timeline";

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // The action target drops milestoneCode into a separate arg.
  const actionTarget =
    target.kind === "client"
      ? ({ kind: "client", contactId: target.contactId } as const)
      : ({ kind: "solicitor", side: target.side } as const);
  const base = { transactionId, target: actionTarget, milestoneCode: target.milestoneCode };

  async function openEditor() {
    setOpen(true);
    setLoading(true);
    try {
      const res = await previewChaseEmailAction(base);
      if (res.ok) { setSubject(res.subject); setBody(res.text); }
    } finally {
      setLoading(false);
    }
  }

  function save() {
    start(async () => {
      await editChaseThreadAction({ ...base, subject, body });
      setOpen(false);
    });
  }
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

      {!open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={openEditor} disabled={pending} className="agent-btn agent-btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px", gap: 6 }}>
            <PencilSimple size={13} weight="bold" aria-hidden /> {edited ? "Edit copy" : "View / edit"}
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
      )}

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--agent-text-muted)", margin: 0 }}>Loading the email…</p>
          ) : (
            <>
              <input
                className="agent-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                aria-label="Chase email subject"
              />
              <textarea
                className="agent-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Email body"
                aria-label="Chase email body"
                style={{ minHeight: 160, resize: "vertical" }}
              />
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                This replaces the standard copy for the next chase to {target.kind === "solicitor" ? "the solicitor" : "this client"}.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={save} disabled={pending} className="agent-btn agent-btn-color-primary" style={{ fontSize: 13, fontWeight: 700, padding: "8px 16px" }}>
                  Save
                </button>
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="agent-btn agent-btn-ghost" style={{ fontSize: 13, padding: "8px 12px" }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
