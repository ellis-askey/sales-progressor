"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

interface SurveyNrConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SurveyNrConfirmModal({ onConfirm, onCancel }: SurveyNrConfirmModalProps) {
  const { theme } = usePortalTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div data-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop — does not dismiss on click; this is a destructive confirmation */}
      <div className="fixed inset-0 agent-backdrop-overlay" />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--agent-surface-elevated)",
          borderRadius: 20,
          border: "0.5px solid rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 380,
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header — no X, 2a non-dismissible */}
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>
            No private survey required?
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.55)", lineHeight: 1.6, margin: 0 }}>
            Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report step will also be skipped.
          </p>
        </div>

        {/* Footer — right-aligned row: Cancel left, Primary right */}
        <div style={{ padding: "0 20px 20px", display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              width: 96, padding: "10px 0", borderRadius: 12,
              background: "transparent", color: "rgba(15,23,42,0.55)",
              fontWeight: 500, fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)", cursor: "pointer", transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="agent-btn-color-primary"
            style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Yes, skip these
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
