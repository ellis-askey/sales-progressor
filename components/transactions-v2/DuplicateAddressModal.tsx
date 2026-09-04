"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

export function DuplicateAddressModal({
  address,
  duplicateId,
  assignedTo,
  onClose,
  onForceCreate,
}: {
  address: string;
  duplicateId: string;
  assignedTo: string | null;
  onClose: () => void;
  onForceCreate: () => void;
}) {
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
      className="nv2-night"
      style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 agent-backdrop-overlay"
        onClick={onClose}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 420,
          borderRadius: 20,
          background: "var(--agent-surface-elevated)",
          border: "0.5px solid var(--nv2-border-modal)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header — X present, 2b dismissible */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, ...SHEET_BAND_STYLE }}>
          <SheetBandHeader kicker="Duplicate" title="Address already on file" />
          <button onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md" style={{ color: "rgba(255,255,255,0.85)", flexShrink: 0 }}>
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 22px 12px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--nv2-text-reading)", lineHeight: 1.6 }}>
            There&apos;s already an active file for{" "}
            <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{address}</strong>.
            {assignedTo && ` Assigned to ${assignedTo}.`}
          </p>
        </div>

        {/* Actions */}
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href={`/agent/transactions/${duplicateId}`}
            className="agent-btn-color-primary"
            style={{
              display: "block",
              padding: "11px 16px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            View existing file
          </Link>
          <button
            type="button"
            onClick={onForceCreate}
            style={{
              padding: "11px 16px", borderRadius: 12, fontWeight: 500, fontSize: 14,
              background: "transparent",
              border: "1.5px solid var(--nv2-border-strong)",
              cursor: "pointer",
              color: "var(--nv2-text-reading)",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nv2-bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Create anyway
          </button>
          <button
            type="button"
            onClick={onClose}
            className="agent-link"
            style={{ padding: "6px", fontSize: 12, fontWeight: 500, textAlign: "center" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
