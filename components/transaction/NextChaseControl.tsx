"use client";

// Per-thread "Next email" control on the Chase timeline. Renders the UPCOMING
// chase inline, exactly as it will land in the recipient's inbox (the real
// branded template in a sandboxed iframe), with a pencil top-right that turns it
// editable in place — same edit the drawer offered — and Skip underneath. Edits
// write a ChaseEmailOverride the cron build honours at fire time. Preview HTML
// comes from previewChaseEmailAction, composed with the exact functions the cron
// uses, so preview == send. See docs/active/chase-consolidation/00-spec.md.

import { useEffect, useState, useTransition } from "react";
import { PencilSimple, Prohibit, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { EmailPreviewFrame } from "@/components/email/EmailPreviewFrame";
import {
  skipChaseThreadAction,
  clearChaseThreadAction,
  editChaseThreadAction,
  previewChaseEmailAction,
} from "@/app/actions/chase-timeline";

type OverrideTarget =
  | { kind: "client"; contactId: string; milestoneCode: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser"; milestoneCode: string };

type Preview = { subject: string; text: string; html: string; recipientName: string; recipientRole: string };

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
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const actionTarget =
    target.kind === "client"
      ? ({ kind: "client", contactId: target.contactId } as const)
      : ({ kind: "solicitor", side: target.side } as const);
  const base = { transactionId, target: actionTarget, milestoneCode: target.milestoneCode };

  // Render the upcoming email inline on mount (and whenever the thread changes).
  useEffect(() => {
    let live = true;
    setLoading(true); setLoadError(null); setMode("view");
    previewChaseEmailAction(base)
      .then((res) => {
        if (!live) return;
        if (res.ok) { setPreview(res); setSubject(res.subject); setBody(res.text); }
        else setLoadError(res.error);
      })
      .catch(() => { if (live) setLoadError("Couldn't build the preview."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, target.milestoneCode]);

  function toggleSkip() { start(async () => { await skipChaseThreadAction({ ...base, skip: !skipped }); }); }
  function reset() { start(async () => { await clearChaseThreadAction(base); }); }

  function handleSave() {
    setSaveError(null);
    startSaving(async () => {
      try {
        await editChaseThreadAction({ ...base, subject, body });
      } catch { setSaveError("Couldn't save the edit. Try again."); return; }
      toast.success("Next email updated");
      const fresh = await previewChaseEmailAction(base);
      if (fresh.ok) { setPreview(fresh); setSubject(fresh.subject); setBody(fresh.text); }
      setMode("view");
    });
  }

  const statusLabel = skipped ? "Next send skipped" : edited ? "Edited copy staged" : "Standard reminder";
  const statusTone = skipped ? "var(--agent-warning)" : edited ? "var(--agent-coral-deep)" : "var(--agent-text-muted)";

  return (
    <div style={{ marginTop: 4, borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Next email</span>
        <span style={{ fontSize: 12, color: statusTone, fontWeight: 600 }}>{statusLabel}</span>
      </div>

      {loading && <p style={{ fontSize: 12.5, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>Building the email…</p>}
      {!loading && loadError && <p style={{ fontSize: 12.5, color: "var(--agent-danger)", margin: 0 }}>{loadError}</p>}

      {preview && (
        <>
          {/* One white card — an email is always light, so its chrome uses explicit
              hex, not agent tokens (which would vanish in dark mode). */}
          <div style={{ position: "relative", border: "1px solid var(--agent-border-strong)", borderRadius: 12, overflow: "hidden", background: "#fff", opacity: skipped ? 0.6 : 1 }}>
            {/* Pencil — turns the email editable in place (view mode only). */}
            {mode === "view" && (
              <button
                type="button"
                onClick={() => setMode("edit")}
                disabled={pending}
                aria-label={edited ? "Edit copy" : "Edit email"}
                title={edited ? "Edit copy" : "Edit email"}
                style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer", background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", color: "#4b5563", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
              >
                <PencilSimple size={14} weight="bold" />
              </button>
            )}

            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5, lineHeight: 1.4 }}>
                <span style={{ width: 52, flexShrink: 0, color: "#6b7280" }}>To</span>
                <span style={{ flex: 1, minWidth: 0, color: "#1f2937", wordBreak: "break-word", paddingRight: mode === "view" ? 36 : 0 }}>
                  {preview.recipientName} <span style={{ color: "#6b7280" }}>· {preview.recipientRole}</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5, lineHeight: 1.4 }}>
                <span style={{ width: 52, flexShrink: 0, color: "#6b7280" }}>Subject</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {mode === "edit" ? (
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} aria-label="Subject" style={{ width: "100%", fontSize: 13, fontWeight: 700, color: "#111827", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 9px", fontFamily: "inherit" }} />
                  ) : (
                    <span style={{ color: "#111827", fontWeight: 700 }}>{preview.subject}</span>
                  )}
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: "#e5e7eb" }} aria-hidden />
            {mode === "view" ? (
              <EmailPreviewFrame html={preview.html} title="Next email preview" minHeight={260} />
            ) : (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={saving} aria-label="Body" style={{ width: "100%", minHeight: 240, border: "none", outline: "none", background: "#fff", color: "#1f2937", fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", padding: "16px 18px", resize: "vertical", boxSizing: "border-box" }} />
            )}
          </div>

          {mode === "edit" && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
              An edited message sends as a plain note, not the branded email above. Leave it unchanged to keep the standard template.
            </p>
          )}
          {mode === "edit" && saveError && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-danger)" }}>{saveError}</p>}

          {/* Actions underneath, bottom-right. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {mode === "edit" ? (
              <>
                <button type="button" onClick={() => { setMode("view"); setSubject(preview.subject); setBody(preview.text); setSaveError(null); }} disabled={saving} className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving || !subject.trim() || !body.trim()} className="agent-btn agent-btn-sm agent-btn-primary">{saving ? "Saving…" : "Save"}</button>
              </>
            ) : (
              <>
                {(edited || skipped) && (
                  <button type="button" onClick={reset} disabled={pending} className="agent-btn agent-btn-ghost agent-btn-sm" style={{ gap: 6 }}>
                    <ArrowCounterClockwise size={13} weight="bold" aria-hidden /> Reset
                  </button>
                )}
                <button type="button" onClick={toggleSkip} disabled={pending} className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 6 }}>
                  <Prohibit size={13} weight="bold" aria-hidden /> {skipped ? "Don't skip" : "Skip next send"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
