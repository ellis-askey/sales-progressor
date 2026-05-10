"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { UndoImpact } from "@/app/actions/milestones";

type UndoMode = "target_only" | "cascade";

interface UndoMilestoneModalProps {
  milestoneName: string;
  milestoneId: string;
  undoData: UndoImpact;
  isPending: boolean;
  onConfirm: (mode: UndoMode) => void;
  onCancel: () => void;
}

export function UndoMilestoneModal({
  milestoneName,
  milestoneId,
  undoData,
  isPending,
  onConfirm,
  onCancel,
}: UndoMilestoneModalProps) {
  const theme = usePortalTheme();
  const [undoMode, setUndoMode] = useState<UndoMode>("target_only");
  const [cascadeExpanded, setCascadeExpanded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const hasCascade = undoData.cascade.length > 0;

  function optionStyle(mode: UndoMode): React.CSSProperties {
    const active = undoMode === mode;
    return {
      display: "block",
      borderRadius: 12,
      border: active
        ? "1.5px solid var(--agent-coral-deep)"
        : "1.5px solid rgba(15,23,42,0.12)",
      background: active ? "var(--agent-coral-bg-tint)" : "transparent",
      padding: 16,
      cursor: "pointer",
      transition: "border-color 150ms, background 150ms",
    };
  }

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      {/* Backdrop — does not dismiss on click */}
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
          maxWidth: 448,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "0.5px solid rgba(15,23,42,0.06)", flexShrink: 0, gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Undo milestone</h3>
            <p style={{ fontSize: 13, color: "rgba(15,23,42,0.50)", marginTop: 4, marginBottom: 0 }}>
              {hasCascade
                ? `${milestoneName} — what would you like to do?`
                : `Are you sure you want to undo "${milestoneName}"?`}
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {!hasCascade ? (
            /* No cascade — simple confirmation */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 14, color: "rgba(15,23,42,0.60)", margin: 0 }}>
                Reverse this milestone. Use this if you ticked the wrong one or it hasn{"'"}t happened yet.
              </p>
              <div style={{ borderRadius: 12, border: "0.5px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: "rgba(15,23,42,0.40)", marginBottom: 2, marginTop: 0 }}>Current</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: "rgba(15,23,42,0.70)", margin: 0 }}>{undoData.currentPercent}%</p>
                </div>
                <svg style={{ width: 16, height: 16, color: "rgba(15,23,42,0.30)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: "rgba(15,23,42,0.40)", marginBottom: 2, marginTop: 0 }}>After</p>
                  <p style={{ fontSize: 20, fontWeight: 600, margin: 0, color: undoData.targetOnlyPercent < undoData.currentPercent ? "#f97316" : "rgba(15,23,42,0.70)" }}>
                    {undoData.targetOnlyPercent}%
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Two options — cascade picker */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Option 1 — target only */}
              <label style={optionStyle("target_only")}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <input
                    type="radio"
                    name={`undoMode-${milestoneId}`}
                    value="target_only"
                    checked={undoMode === "target_only"}
                    onChange={() => setUndoMode("target_only")}
                    style={{ marginTop: 2, accentColor: "var(--agent-coral-deep)", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Undo this milestone only</p>
                    <p style={{ fontSize: 12, color: "rgba(15,23,42,0.55)", marginTop: 4, marginBottom: 0 }}>
                      Reverse this milestone but keep downstream work as-is. Use this if you ticked the wrong one or it hasn{"'"}t happened yet.
                    </p>
                    <p style={{ fontSize: 12, color: "rgba(15,23,42,0.55)", marginTop: 6, marginBottom: 0 }}>
                      Progress: <span style={{ fontWeight: 500 }}>{undoData.currentPercent}% → {undoData.targetOnlyPercent}%</span>
                    </p>
                    <p style={{ fontSize: 12, color: "#ea580c", marginTop: 6, marginBottom: 0 }}>
                      Note: {undoData.cascade.length} downstream milestone{undoData.cascade.length !== 1 ? "s are" : " is"} complete.{" "}
                      {undoData.cascade.length !== 1 ? "They" : "It"} will stay complete and may need re-checking later if this milestone is permanently undone.
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 2 — cascade */}
              <label style={optionStyle("cascade")}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <input
                    type="radio"
                    name={`undoMode-${milestoneId}`}
                    value="cascade"
                    checked={undoMode === "cascade"}
                    onChange={() => setUndoMode("cascade")}
                    style={{ marginTop: 2, accentColor: "var(--agent-coral-deep)", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Undo this and downstream milestones</p>
                    <p style={{ fontSize: 12, color: "rgba(15,23,42,0.55)", marginTop: 4, marginBottom: 0 }}>
                      Reverse this milestone and all completed dependents. Use this if the chain of work genuinely didn{"'"}t happen.
                    </p>
                    <p style={{ fontSize: 12, color: "rgba(15,23,42,0.55)", marginTop: 6, marginBottom: 0 }}>
                      Progress: <span style={{ fontWeight: 500 }}>{undoData.currentPercent}% → {undoData.cascadePercent}%</span>
                    </p>
                    <div style={{ marginTop: 8, borderRadius: 8, border: "0.5px solid rgba(15,23,42,0.08)", overflow: "hidden" }}>
                      {(cascadeExpanded ? undoData.cascade : undoData.cascade.slice(0, 5)).map((item) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "0.5px solid rgba(15,23,42,0.04)" }}>
                          <svg style={{ width: 12, height: 12, color: "#fb923c", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span style={{ fontSize: 12, color: "rgba(15,23,42,0.75)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </span>
                          {item.reconciledAtExchange && (
                            <span style={{ fontSize: 10, color: "#7c3aed", background: "#f5f3ff", border: "0.5px solid #ede9fe", borderRadius: 4, padding: "2px 4px", flexShrink: 0 }}>
                              reconciled
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {undoData.cascade.length > 5 && (
                      <button
                        onClick={(e) => { e.preventDefault(); setCascadeExpanded((v) => !v); }}
                        className="agent-link-primary text-xs"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 6 }}
                      >
                        {cascadeExpanded ? "Show fewer" : `Show ${undoData.cascade.length - 5} more`}
                      </button>
                    )}
                    {(() => {
                      const rc = undoData.cascade.filter((m) => m.reconciledAtExchange).length;
                      return rc > 0 ? (
                        <p style={{ fontSize: 12, color: "rgba(15,23,42,0.40)", marginTop: 8, marginBottom: 0 }}>
                          Note: {rc} milestone{rc !== 1 ? "s" : ""} marked complete during exchange reconciliation will also be reversed.
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer — paired: orange Undo (semantic warning) + neutral Cancel */}
        <div style={{ padding: "12px 24px 20px", borderTop: "0.5px solid rgba(15,23,42,0.06)", display: "flex", gap: 12, flexShrink: 0 }}>
          <button
            onClick={() => onConfirm(undoMode)}
            disabled={isPending}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 12,
              background: "#f97316",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.5 : 1,
              transition: "background 150ms, opacity 150ms",
            }}
            onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "#ea580c"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#f97316"; }}
          >
            {isPending
              ? "Undoing…"
              : undoMode === "cascade" && undoData.cascade.length > 0
              ? `Undo milestone and ${undoData.cascade.length} dependent${undoData.cascade.length !== 1 ? "s" : ""}`
              : "Undo milestone"}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 12,
              background: "transparent",
              color: "rgba(15,23,42,0.60)",
              fontWeight: 500,
              fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)",
              cursor: isPending ? "not-allowed" : "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "rgba(15,23,42,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
