"use client";

import { useState } from "react";
import type { DraftEntry } from "@/components/transactions-v2/types";
import { useSolidMode } from "@/lib/hooks/useSolidMode";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Props = {
  drafts: DraftEntry[];
  currentDraftId: string | null;
  onLoad: (draft: DraftEntry) => void;
  onDelete: (draftId: string) => void;
};

export function DraftPanel({ drafts, currentDraftId, onLoad, onDelete }: Props) {
  const isSolid = useSolidMode();
  const [open, setOpen] = useState(false);
  const [pillHovered, setPillHovered] = useState(false);

  if (drafts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 24, left: 24, zIndex: 100,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
      }}
    >
      {open && (
        <div
          className="v2-draft-panel"
          style={{
            width: 272,
            borderRadius: 16,
            background: isSolid ? "var(--nv2-surface-solid)" : "var(--nv2-surface-raised)",
            backdropFilter: isSolid ? "none" : "blur(32px)",
            WebkitBackdropFilter: isSolid ? "none" : "blur(32px)",
            border: isSolid ? "1px solid var(--nv2-border-solid)" : "0.5px solid var(--nv2-border-glass)",
            boxShadow: "0 16px 48px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px 10px", borderBottom: "0.5px solid var(--nv2-border-dark)" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--nv2-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Saved drafts
            </p>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="agent-hover-row"
                style={{
                  padding: "10px 14px",
                  borderBottom: "0.5px solid var(--nv2-border-dark)",
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: draft.id === currentDraftId
                    ? "rgba(var(--agent-coral-base-rgb),0.06)"
                    : "transparent",
                }}
              >
                <button
                  type="button"
                  onClick={() => onLoad(draft)}
                  style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                >
                  <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {draft.propertyAddress || "Unnamed draft"}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--nv2-text-muted)" }}>
                    {relativeTime(draft.createdAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(draft.id)}
                  aria-label="Remove draft"
                  className="agent-icon-btn agent-icon-btn-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setPillHovered(true)}
        onMouseLeave={() => setPillHovered(false)}
        style={{
          padding: "7px 14px", borderRadius: 20,
          background: isSolid
            ? (pillHovered ? "var(--nv2-bg-hover)" : "var(--nv2-surface-solid)")
            : "var(--nv2-surface-raised)",
          backdropFilter: isSolid ? "none" : "blur(24px)",
          WebkitBackdropFilter: isSolid ? "none" : "blur(24px)",
          border: pillHovered
            ? "1px solid var(--agent-border-strong)"
            : isSolid ? "1px solid var(--nv2-border-solid)" : "0.5px solid var(--nv2-border-glass)",
          boxShadow: "0 4px 16px rgba(15,23,42,0.10)",
          fontSize: 12, fontWeight: 600, color: "var(--nv2-text-reading)",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          transition: "background 150ms, border-color 150ms",
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--agent-coral-deep)", flexShrink: 0,
          }}
        />
        {open ? "Hide drafts" : `${drafts.length} draft${drafts.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
