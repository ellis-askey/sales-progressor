"use client";

// Email preview / edit modal. Surfaces an OutboundEmailQueue row's full
// payload so the agent can see exactly what's going to land in the
// recipient's inbox, with an optional edit mode for pending CLIENT_CHASE
// emails.
//
// Two modes:
//   - view: read-only display of subject + body, header chrome shows
//           recipient / scheduled-for / sent-at / edit audit if any.
//   - edit: subject + textarea (body), Save calls updateEmailPayload.
//           HTML stays unchanged (template-structured, agent prose can't
//           safely replace it — most clients prefer text/plain anyway).
//
// Permission-gated server-side; the canEdit flag from getEmailForPreview
// drives whether the Edit button is shown at all so the affordance never
// dangles.
//
// Matches NavAwayModal's chrome: portal-to-body, agent-backdrop-overlay,
// agent-modal-in animation, escape-to-close, X button.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Pencil } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { updateEmailPayload, getEmailForPreview } from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

type PreviewData = NonNullable<Awaited<ReturnType<typeof getEmailForPreview>> & { ok: true }>["data"];

type Props = {
  emailId: string;
  onClose: () => void;
  onSaved?: () => void;
};

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function EmailPreviewModal({ emailId, onClose, onSaved }: Props) {
  const { theme, isNight } = usePortalTheme();
  const { toast } = useAgentToast();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load on mount.
  useEffect(() => {
    let mounted = true;
    getEmailForPreview(emailId).then((res) => {
      if (!mounted) return;
      if (res.ok) {
        setData(res.data);
        setSubject(res.data.subject);
        setText(res.data.text);
      } else {
        setLoadError(res.error);
      }
    });
    return () => { mounted = false; };
  }, [emailId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    setSaveError(null);
    startSaving(async () => {
      const res = await updateEmailPayload(emailId, { subject, text });
      if (res.ok) {
        toast.success("Email updated");
        onSaved?.();
        onClose();
      } else {
        setSaveError(res.error);
        toast.error("Couldn't update email — try again");
      }
    });
  }

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onClose} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--agent-surface-elevated)",
          borderRadius: 20,
          border: "0.5px solid rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header — Ribbon coral band */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            ...SHEET_BAND_STYLE,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            flexShrink: 0,
          }}
        >
          <SheetBandHeader kicker="Email" title={mode === "edit" ? "Edit email" : "Email preview"} />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loadError && (
            <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>
              {loadError}
            </p>
          )}

          {!data && !loadError && (
            <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: 0, fontStyle: "italic" }}>
              Loading…
            </p>
          )}

          {data && (
            <>
              {/* Meta strip */}
              <div
                style={{
                  background: "var(--agent-surface-glass)",
                  border: "0.5px solid rgba(15,23,42,0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 14,
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "var(--agent-text-secondary)",
                }}
              >
                <div>
                  <span style={{ color: "var(--agent-text-muted)" }}>To: </span>
                  <span style={{ fontWeight: 500, color: "var(--agent-text-primary)" }}>
                    {data.recipientName}
                  </span>
                  {data.recipientRole && (
                    <span style={{ color: "var(--agent-text-muted)" }}> ({data.recipientRole})</span>
                  )}
                  <span style={{ color: "var(--agent-text-muted)" }}> · {data.recipientEmail}</span>
                </div>
                <div>
                  <span style={{ color: "var(--agent-text-muted)" }}>
                    {data.sentAt ? "Sent: " : data.errorAt ? "Failed: " : "Sends: "}
                  </span>
                  {formatDateTime(data.sentAt ?? data.errorAt ?? data.scheduledFor)}
                </div>
                {data.editedAt && (
                  <div>
                    <span style={{ color: "var(--agent-text-muted)" }}>Edited: </span>
                    {formatDateTime(data.editedAt)}
                    {data.editedByName && (
                      <span style={{ color: "var(--agent-text-muted)" }}> by {data.editedByName}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Subject + body */}
              {mode === "view" ? (
                <>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--agent-text-muted)",
                      margin: "0 0 4px",
                    }}
                  >
                    Subject
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--agent-text-primary)",
                      margin: "0 0 16px",
                    }}
                  >
                    {data.subject}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--agent-text-muted)",
                      margin: "0 0 4px",
                    }}
                  >
                    Body (what most recipients see)
                  </p>
                  <pre
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--agent-text-primary)",
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      background: "var(--agent-surface-glass)",
                      border: "0.5px solid rgba(15,23,42,0.08)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      margin: 0,
                    }}
                  >
                    {data.text}
                  </pre>
                </>
              ) : (
                <>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--agent-text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSaving}
                    style={{
                      width: "100%",
                      fontSize: 14,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "var(--agent-surface-elevated)",
                      color: "var(--agent-text-primary)",
                      marginBottom: 14,
                    }}
                  />
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--agent-text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Body
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isSaving}
                    rows={12}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      lineHeight: 1.6,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "var(--agent-surface-elevated)",
                      color: "var(--agent-text-primary)",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                  {saveError && (
                    <p style={{ fontSize: 12, color: "var(--agent-danger)", marginTop: 8, marginBottom: 0 }}>
                      {saveError}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px 20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: "0.5px solid rgba(15,23,42,0.08)",
            flexShrink: 0,
          }}
        >
          {mode === "view" ? (
            <>
              <button onClick={onClose} className="agent-link" style={{ padding: "10px 12px", fontSize: 13 }}>
                Close
              </button>
              {data?.canEdit && (
                <button
                  onClick={() => setMode("edit")}
                  className="agent-btn-color-primary"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Pencil size={13} weight="bold" /> Edit
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (data) {
                    setSubject(data.subject);
                    setText(data.text);
                  }
                  setSaveError(null);
                  setMode("view");
                }}
                disabled={isSaving}
                className="agent-link"
                style={{ padding: "10px 12px", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !subject.trim() || !text.trim()}
                className="agent-btn-color-primary"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: isSaving ? "default" : "pointer",
                }}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
