"use client";

// Right-side drawer for the chase timeline's "Next email" control. Shows the
// UPCOMING chase exactly as it will land in the recipient's inbox — the real
// branded template rendered in a sandboxed iframe — and lets the agent edit its
// subject/body. The narrow timeline details column can't hold a 560px email, so
// the preview lives here; the inline control keeps only the status + buttons.
//
// The rendered HTML comes from previewChaseEmailAction, which composes it with
// the exact same functions the cron build uses (branded template, or the plain
// edited-body frame when a body override is staged), so preview == send. Saving
// writes a ChaseEmailOverride the cron honours at fire time. See
// docs/active/chase-consolidation/00-spec.md.

import { useEffect, useState, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { EmailPreviewFrame } from "@/components/email/EmailPreviewFrame";
import {
  editChaseThreadAction,
  previewChaseEmailAction,
} from "@/app/actions/chase-timeline";

type OverrideTarget =
  | { kind: "client"; contactId: string; milestoneCode: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser"; milestoneCode: string };

type Preview = {
  subject: string;
  text: string;
  html: string;
  recipientName: string;
  recipientRole: string;
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 15px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 7,
};

export function NextChaseEmailDrawer({
  open,
  onClose,
  transactionId,
  target,
  edited,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  target: OverrideTarget;
  edited: boolean;
}) {
  const { toast } = useAgentToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // The action target drops milestoneCode into a separate arg.
  const actionTarget =
    target.kind === "client"
      ? ({ kind: "client", contactId: target.contactId } as const)
      : ({ kind: "solicitor", side: target.side } as const);
  const base = { transactionId, target: actionTarget, milestoneCode: target.milestoneCode };

  // Load the rendered email each time the drawer opens (it may have changed
  // since last time — the copy is regenerated from the live file state).
  useEffect(() => {
    if (!open) return;
    let live = true;
    setPreview(null); setLoadError(null); setMode("view"); setSaveError(null);
    setLoading(true);
    previewChaseEmailAction(base)
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          setPreview(res);
          setSubject(res.subject);
          setBody(res.text);
        } else {
          setLoadError(res.error);
        }
      })
      .catch(() => { if (live) setLoadError("Couldn't build the preview."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId, target.milestoneCode]);

  function handleSave() {
    setSaveError(null);
    startSaving(async () => {
      try {
        await editChaseThreadAction({ ...base, subject, body });
      } catch {
        setSaveError("Couldn't save the edit. Try again.");
        return;
      }
      toast.success("Next email updated");
      // Re-fetch so the rendered preview reflects the saved edit (an edited
      // body now renders in the plain frame, matching the send).
      const fresh = await previewChaseEmailAction(base);
      if (fresh.ok) { setPreview(fresh); setSubject(fresh.subject); setBody(fresh.text); }
      setMode("view");
    });
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Next chase email" size="xl" closeTone="onDark">
      <Drawer.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader
          kicker="Next email"
          title={preview?.recipientName ? `To ${preview.recipientName}` : "Upcoming chase"}
        />
      </Drawer.Header>

      <Drawer.Body>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <p className="agent-eyebrow" style={{ margin: 0 }}>
            {mode === "edit" ? "Edit the next email" : "How it will send"}
          </p>
          {edited && mode === "view" && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep)", letterSpacing: "0.02em" }}>
              Edited copy staged
            </span>
          )}
        </div>

        {loading && <p style={{ fontSize: 13, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>Building the email…</p>}
        {loadError && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{loadError}</p>}

        {preview && (
          /* One white card — an email is always light, so the chrome is explicit
             hex, not agent tokens (which would vanish in dark mode). To/Subject
             on top, the rendered email (or its editable body) below. */
          <div style={{ border: "1px solid var(--agent-border-strong)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.4 }}>
                <span style={{ width: 58, flexShrink: 0, color: "#6b7280" }}>To</span>
                <span style={{ flex: 1, minWidth: 0, color: "#1f2937", wordBreak: "break-word" }}>
                  {preview.recipientName} <span style={{ color: "#6b7280" }}>· {preview.recipientRole}</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.4 }}>
                <span style={{ width: 58, flexShrink: 0, color: "#6b7280" }}>Subject</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {mode === "edit" ? (
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={saving}
                      aria-label="Subject"
                      style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#111827", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 9px", fontFamily: "inherit" }}
                    />
                  ) : (
                    <span style={{ color: "#111827", fontWeight: 700 }}>{preview.subject}</span>
                  )}
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: "#e5e7eb" }} aria-hidden />
            {mode === "view" ? (
              <EmailPreviewFrame html={preview.html} title="Next email preview" minHeight={280} />
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={saving}
                aria-label="Body"
                style={{ width: "100%", minHeight: 380, border: "none", outline: "none", background: "#fff", color: "#1f2937", fontSize: 15, lineHeight: 1.65, fontFamily: "inherit", padding: "20px", resize: "vertical", boxSizing: "border-box" }}
              />
            )}
          </div>
        )}

        {mode === "edit" && (
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            An edited message sends as a plain note, not the branded email above. Leave it unchanged to keep the standard branded template.
          </p>
        )}
        {mode === "edit" && saveError && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--agent-danger)" }}>{saveError}</p>
        )}
      </Drawer.Body>

      <Drawer.Footer>
        {mode === "view" ? (
          <button
            onClick={() => setMode("edit")}
            disabled={loading || !preview}
            className="email-detail-outline-btn"
            style={{ ...primaryBtn, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", border: "0.5px solid var(--agent-border-strong)" }}
          >
            <PencilSimple size={14} weight="bold" /> {edited ? "Edit copy" : "Edit email"}
          </button>
        ) : (
          <>
            <button
              onClick={() => { setMode("view"); setSubject(preview?.subject ?? ""); setBody(preview?.text ?? ""); setSaveError(null); }}
              className="agent-btn agent-btn-neutral agent-btn-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="agent-btn-color-primary"
              style={primaryBtn}
              disabled={saving || !subject.trim() || !body.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </Drawer.Footer>

      <style>{`
        .email-detail-outline-btn:hover:not(:disabled) { background: var(--agent-surface-glass) !important; border-color: var(--agent-text-muted) !important; }
        .email-detail-outline-btn:disabled { opacity: 0.55; cursor: default; }
      `}</style>
    </Drawer>
  );
}
