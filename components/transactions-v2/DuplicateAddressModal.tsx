"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "agent-backdrop-in 180ms ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          borderRadius: 20,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(40px)",
          border: "0.5px solid rgba(255,255,255,0.80)",
          boxShadow: "0 32px 80px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)",
          overflow: "hidden",
          animation: "agent-modal-in 280ms cubic-bezier(0.16,1,0.3,1) both",
          borderTop: "3px solid var(--agent-coral-deep)",
        }}
      >
        <div style={{ padding: "24px 24px 20px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Address already exists
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "rgba(15,23,42,0.60)", lineHeight: 1.55 }}>
            There&apos;s already an active file for{" "}
            <strong style={{ color: "var(--agent-text-primary)" }}>{address}</strong>.
            {assignedTo && ` It is assigned to ${assignedTo}.`}
          </p>
        </div>
        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={`/agent/transactions/${duplicateId}`}
            style={{
              display: "block", padding: "11px 16px", borderRadius: 12,
              fontWeight: 600, fontSize: 14,
              background: "var(--agent-coral-deep)", color: "#fff",
              textAlign: "center", textDecoration: "none",
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
            }}
          >
            Create anyway
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 0, background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "rgba(15,23,42,0.38)", fontWeight: 500, textAlign: "center",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
