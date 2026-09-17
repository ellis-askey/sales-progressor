"use client";

// "Take off hold" resume chooser — presentational. Mirrors the chooser
// embedded in StatusControl / AttentionCard / ReviewsSection (the two-option
// pattern is the founder-approved copy): resume automation vs reactivate with
// client emails kept paused. Extracted 2026-09-18 for the hub's
// Files-to-review card; the older embedded copies are grandfathered until
// their surfaces are next touched (Law 19).

import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

function ResumeOptionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="agent-hover-row"
      style={{
        textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
        background: "var(--agent-surface-glass)", border: "0.5px solid rgba(15,23,42,0.10)",
        transition: "background 150ms, border-color 150ms, box-shadow 150ms",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 11.5, color: "var(--agent-text-secondary)", margin: "3px 0 0", lineHeight: 1.5 }}>{description}</p>
    </button>
  );
}

export function ResumeFileModal({ address, onCancel, onResume }: {
  address: string;
  onCancel: () => void;
  onResume: (keepEmailsPaused: boolean) => void;
}) {
  const { theme, isNight } = usePortalTheme();
  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night"
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onCancel} style={{ zIndex: 0 }} />
      <div
        className="rounded-2xl w-full max-w-md"
        style={{
          position: "relative", zIndex: 1, overflow: "hidden",
          display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 48px)",
          background: "var(--agent-surface-elevated)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...SHEET_BAND_STYLE, flexShrink: 0 }}>
          <SheetBandHeader kicker="Reactivate" title="Take off hold" subtitle={address} />
        </div>
        <div className="px-6 py-5 space-y-3" style={{ overflowY: "auto", minHeight: 0 }}>
          <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Pick one — you can always change later.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ResumeOptionCard
              title="Resume automation"
              description="Client chase emails, reminders + escalations restart from where they left off."
              onClick={() => onResume(false)}
            />
            <ResumeOptionCard
              title="Reactivate, keep emails paused"
              description="File is active again but no client emails fire. Manual chasing only. Flip back on from the file's email settings any time."
              onClick={() => onResume(true)}
            />
          </div>
        </div>
        <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
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
