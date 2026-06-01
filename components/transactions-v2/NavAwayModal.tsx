"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Props = {
  isSaving: boolean;
  onDiscard: () => void;
  onStay: () => void;
  onSave: () => void;
};

export function NavAwayModal({ isSaving, onDiscard, onStay, onSave }: Props) {
  const { theme, isNight } = usePortalTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onStay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night"
      style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onStay} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--agent-surface-elevated)",
          borderRadius: 20,
          border: "0.5px solid var(--nv2-border-modal)",
          width: "100%",
          maxWidth: 380,
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid var(--nv2-border-dark)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--nv2-text-primary)", margin: 0 }}>
            Save your draft?
          </p>
          <button onClick={onStay} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 20px 4px" }}>
          <p style={{ fontSize: 13, color: "var(--nv2-text-secondary)", lineHeight: 1.6, margin: 0 }}>
            You have unsaved changes. Save them as a draft to come back later.
          </p>
        </div>

        {/* Footer — three actions, left to right: discard / stay / save */}
        <div className="v2-modal-footer" style={{ padding: "14px 20px 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onDiscard}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 12,
              background: "transparent", color: "var(--nv2-text-reading)",
              fontWeight: 500, fontSize: 13, border: "1px solid var(--nv2-border-strong)",
              cursor: "pointer", transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nv2-bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Discard changes
          </button>

          <button
            onClick={onStay}
            className="agent-link"
            style={{ flexShrink: 0, padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
          >
            Stay here
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="agent-btn-color-primary"
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 12,
              fontWeight: 600, fontSize: 13, border: "none",
              cursor: isSaving ? "default" : "pointer",
            }}
          >
            {isSaving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
