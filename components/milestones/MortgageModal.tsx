"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

interface MortgageModalProps {
  onConfirmMortgage: () => void;
  onConfirmReinstate: () => void;
  onCancel: () => void;
}

export function MortgageModal({ onConfirmMortgage, onConfirmReinstate, onCancel }: MortgageModalProps) {
  const theme = usePortalTheme();

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
            Is this buyer now using a mortgage?
          </p>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer", flexShrink: 0, marginLeft: 12 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 20px 4px" }}>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.45)", lineHeight: 1.6, margin: 0 }}>
            Reinstating this will re-open the mortgage steps and update the purchase type.
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
            Reinstate without changing purchase type
          </button>

          {/* Tertiary */}
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
