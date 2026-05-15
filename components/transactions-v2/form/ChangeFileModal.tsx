"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Props = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ChangeFileModal({ onConfirm, onCancel }: Props) {
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
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onCancel} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(255,255,255,0.98)",
          borderRadius: 20,
          borderTop: "2px solid #f59e0b",
          width: "100%",
          maxWidth: 360,
          margin: "0 16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>
            Change memo?
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
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.50)", lineHeight: 1.6, margin: 0 }}>
            This will replace your edits with data from the new memo.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onConfirm}
            className="agent-btn-color-primary"
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Change file
          </button>
          <button
            onClick={onCancel}
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, background: "transparent", color: "rgba(15,23,42,0.60)", fontWeight: 500, fontSize: 14, border: "1px solid rgba(15,23,42,0.15)", cursor: "pointer", transition: "background 150ms" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
