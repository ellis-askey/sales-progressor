"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

interface SurveyNrConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SurveyNrConfirmModal({ onConfirm, onCancel }: SurveyNrConfirmModalProps) {
  const theme = usePortalTheme();

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
          background: "rgba(255,255,255,0.98)",
          borderRadius: 20,
          borderTop: "2px solid var(--agent-coral-deep)",
          width: "100%",
          maxWidth: 380,
          margin: "0 16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>
            No private survey required?
          </p>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.55)", lineHeight: 1.6, margin: 0 }}>
            Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report milestone will also be marked as not required.
          </p>
        </div>

        {/* Footer — stacked */}
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onConfirm}
            className="agent-btn-color-primary"
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Yes, mark as not required
          </button>
          <button
            onClick={onCancel}
            style={{ width: "100%", padding: "8px 16px", background: "transparent", fontSize: 14, fontWeight: 500, color: "rgba(15,23,42,0.50)", border: "none", cursor: "pointer", borderRadius: 8 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(15,23,42,0.70)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(15,23,42,0.50)")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
