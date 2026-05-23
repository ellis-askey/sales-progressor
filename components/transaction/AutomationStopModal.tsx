"use client";

// "How do you want to stop?" chooser modal for the AutomationControls
// banner. Surfaces when the agent toggles automation OFF — two clickable
// options, either of which fires the matching server action and closes
// the modal. Mirrors the NavAwayModal pattern (createPortal + theme
// attribute + agent-backdrop-overlay + agent-modal-in animation) so the
// chrome blends with the rest of the agent app's modals.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Choice = "pause" | "hold";

type Props = {
  onPick: (choice: Choice) => void;
  onClose: () => void;
  isPending: boolean;
};

export function AutomationStopModal({ onPick, onClose, isPending }: Props) {
  const { theme, isNight } = usePortalTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
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
          maxWidth: 460,
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "0.5px solid rgba(15,23,42,0.08)",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
            Stop automation on this file
          </p>
          <button onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 20px 4px" }}>
          <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Pick one — you can always change later.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <ChooserCard
              title="Pause client emails"
              description="No automated chases will send. The team still sees reminders so they can chase manually. Chase clock keeps running."
              onClick={() => onPick("pause")}
              disabled={isPending}
            />
            <ChooserCard
              title="Put file on hold"
              description="Freezes everything — no emails, no reminders, no escalations until you reactivate."
              onClick={() => onPick("hold")}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            className="agent-link"
            style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ChooserCard({
  title,
  description,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: "var(--agent-surface-glass)",
        border: "0.5px solid rgba(15,23,42,0.10)",
        borderRadius: 12,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 150ms, border-color 150ms",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--agent-hover-tint, rgba(255,107,74,0.06))";
          e.currentTarget.style.borderColor = "rgba(255,107,74,0.30)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--agent-surface-glass)";
        e.currentTarget.style.borderColor = "rgba(15,23,42,0.10)";
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>
          {description}
        </p>
      </div>
      <span style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", marginTop: 2 }}>
        <ArrowRight size={14} weight="bold" />
      </span>
    </button>
  );
}
