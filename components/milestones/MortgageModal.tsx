"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

interface MortgageModalProps {
  onConfirmMortgage: () => void;
  onConfirmReinstate: () => void;
  onCancel: () => void;
}

export function MortgageModal({ onConfirmMortgage, onConfirmReinstate, onCancel }: MortgageModalProps) {
  const { theme } = usePortalTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* Backdrop — does not dismiss on click; user must choose one of three options */}
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
            Is this buyer now using a mortgage?
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 20px 4px" }}>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.45)", lineHeight: 1.6, margin: 0 }}>
            This re-opens the mortgage steps and updates the purchase type.
          </p>
        </div>

        {/* Footer — three-tier stacked */}
        <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Primary */}
          <button
            onClick={onConfirmMortgage}
            className="agent-btn-color-primary"
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Yes — mortgage buyer
          </button>

          {/* Secondary */}
          <button
            onClick={onConfirmReinstate}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 12,
              background: "transparent",
              color: "rgba(15,23,42,0.65)",
              fontWeight: 500,
              fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Re-open without changing purchase type
          </button>

          {/* Tertiary */}
          <button
            onClick={onCancel}
            className="agent-btn agent-btn-ghost-bordered w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
