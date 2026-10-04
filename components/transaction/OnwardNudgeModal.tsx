"use client";

// Review-and-send modal for the onward / related-sale client nudge (critique
// #197). Clicking "Ask {name} to set it up / update it" opens this instead of
// firing immediately: the agent sees exactly what the client will receive, can
// edit the wording, and then sends. Mirrors EmailPreviewModal's chrome
// (portal-to-body, Ribbon header, sandboxed iframe preview). The nudge email
// builder is pure, so the preview re-renders live as they edit, and the same
// edited copy is passed to the send action.

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { extractFirstName } from "@/lib/contacts/displayName";
import { buildOnwardNudgeEmail, type OnwardNudgeDirection, type OnwardNudgeMode } from "@/lib/emails/onward-nudge";
import { previewOnwardNudgeAction, sendOnwardNudgeAction, type OnwardNudgePreview } from "@/app/actions/onward";

type Props = {
  transactionId: string;
  contactId: string;
  direction: OnwardNudgeDirection;
  mode: OnwardNudgeMode;
  onClose: () => void;
  onSent: () => void;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--agent-text-muted)",
  margin: "0 0 4px",
};
const fieldStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  lineHeight: 1.55,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "var(--agent-surface-elevated)",
  color: "var(--agent-text-primary)",
  fontFamily: "inherit",
};

export function OnwardNudgeModal({ transactionId, contactId, direction, mode, onClose, onSent }: Props) {
  const { theme, isNight } = usePortalTheme();
  const { toast } = useAgentToast();
  const [data, setData] = useState<OnwardNudgePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  useEffect(() => {
    let mounted = true;
    previewOnwardNudgeAction({ transactionId, contactId, direction, mode }).then((res) => {
      if (!mounted) return;
      if (res.ok) {
        setData(res.data);
        setSubject(res.data.copy.subject);
        setLead(res.data.copy.lead);
        setBody(res.data.copy.body);
      } else {
        setLoadError(res.error);
      }
    });
    return () => { mounted = false; };
  }, [transactionId, contactId, direction, mode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Live preview — the exact builder the send uses, re-rendered as they edit.
  const previewHtml = useMemo(() => {
    if (!data) return "";
    return buildOnwardNudgeEmail({
      agencyName: data.agencyName,
      greeting: data.greeting,
      direction,
      mode,
      propertyAddress: data.propertyAddress,
      portalUrl: data.portalUrl,
      theme: data.theme,
      copy: { subject, lead, body, cta: data.copy.cta },
    }).html;
  }, [data, subject, lead, body, direction, mode]);

  function handleSend() {
    setSendError(null);
    startSending(async () => {
      const res = await sendOnwardNudgeAction({ transactionId, contactId, direction, mode, copy: { subject, lead, body } });
      if (res.ok) {
        toast.success(`Sent to ${data ? extractFirstName(data.recipientName) : "the client"}`);
        onSent();
        onClose();
      } else {
        setSendError(res.error ?? "Couldn't send that just now.");
      }
    });
  }

  const canSend = !!data && !!subject.trim() && !!lead.trim() && !!body.trim();

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onClose} />

      <div
        style={{
          position: "relative", zIndex: 1,
          background: "var(--agent-surface-elevated)",
          borderRadius: 20, border: "0.5px solid rgba(0,0,0,0.08)",
          width: "100%", maxWidth: 600, maxHeight: "85vh", margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, ...SHEET_BAND_STYLE, borderTopLeftRadius: 20, borderTopRightRadius: 20, flexShrink: 0 }}>
          <SheetBandHeader kicker="Review and send" title="Email to your client" />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loadError && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{loadError}</p>}
          {!data && !loadError && <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: 0, fontStyle: "italic" }}>Loading…</p>}

          {data && (
            <>
              {/* Recipient */}
              <div style={{ background: "var(--agent-surface-glass)", border: "0.5px solid rgba(15,23,42,0.08)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "var(--agent-text-secondary)" }}>
                <span style={{ color: "var(--agent-text-muted)" }}>To: </span>
                <span style={{ fontWeight: 500, color: "var(--agent-text-primary)" }}>{data.recipientName}</span>
                <span style={{ color: "var(--agent-text-muted)" }}> · {data.recipientEmail}</span>
              </div>

              {/* Editable copy */}
              <label style={labelStyle}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isSending} style={{ ...fieldStyle, fontSize: 14, marginBottom: 14 }} />

              <label style={labelStyle}>Opening</label>
              <textarea value={lead} onChange={(e) => setLead(e.target.value)} disabled={isSending} rows={2} style={{ ...fieldStyle, resize: "vertical", marginBottom: 14 }} />

              <label style={labelStyle}>Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={isSending} rows={3} style={{ ...fieldStyle, resize: "vertical", marginBottom: 18 }} />

              {/* Live preview */}
              <p style={labelStyle}>Preview (what they&rsquo;ll receive)</p>
              <iframe
                title="Nudge preview"
                srcDoc={previewHtml}
                sandbox=""
                style={{ width: "100%", minHeight: 320, border: "0.5px solid rgba(15,23,42,0.08)", borderRadius: 8, background: "#fff" }}
              />

              {sendError && <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: "10px 0 0" }}>{sendError}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px 20px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "0.5px solid rgba(15,23,42,0.08)", flexShrink: 0 }}>
          <button onClick={onClose} disabled={isSending} className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
          <button
            onClick={handleSend}
            disabled={!canSend || isSending}
            className="agent-btn-color-primary"
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: !canSend || isSending ? "default" : "pointer", opacity: !canSend || isSending ? 0.6 : 1 }}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
