"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

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
  const theme = usePortalTheme();

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
          background: "rgba(255,255,255,0.98)",
          borderTop: "3px solid var(--agent-coral-deep)",
          boxShadow: "0 24px 64px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)",
          overflow: "hidden",
          animation: "agent-modal-in 280ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Body */}
        <div style={{ padding: "22px 22px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Address already exists
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(15,23,42,0.58)", lineHeight: 1.6 }}>
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
              border: "1.5px solid rgba(15,23,42,0.15)",
              cursor: "pointer",
              color: "rgba(15,23,42,0.65)",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
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
