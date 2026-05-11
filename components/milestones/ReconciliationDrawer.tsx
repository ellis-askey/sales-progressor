"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { getEventDateLabel } from "@/lib/portal-copy";

export type ReconciliationItem = {
  id: string;
  name: string;
  side: string;
  code: string;
  eventDateRequired: boolean;
};

interface ReconciliationDrawerProps {
  isExchangeFlow: boolean;
  outstanding: ReconciliationItem[];
  initialEventDate: string;
  pendingEventDate?: string;
  onConfirm: (
    eventDate: string | undefined,
    outstandingIds: string[],
    outstandingDates: Record<string, string>,
    completionDate?: string
  ) => void;
  onCancel: () => void;
}

export function ReconciliationDrawer({
  isExchangeFlow,
  outstanding,
  initialEventDate,
  pendingEventDate,
  onConfirm,
  onCancel,
}: ReconciliationDrawerProps) {
  const theme = usePortalTheme();

  const [eventDate, setEventDate] = useState(initialEventDate);
  const [completionDate, setCompletionDate] = useState("");
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(
    () => new Set(outstanding.map((m) => m.id))
  );
  const [reconciledDates, setReconciledDates] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function handleConfirm() {
    const effectiveIds = [...reconciledIds].filter((id) => {
      const item = outstanding.find((m) => m.id === id);
      if (!item) return false;
      if (item.eventDateRequired && !reconciledDates[id]) return false;
      return true;
    });
    onConfirm(
      eventDate || pendingEventDate,
      effectiveIds,
      Object.fromEntries(Object.entries(reconciledDates).filter(([, v]) => !!v)),
      completionDate || undefined
    );
  }

  const title = isExchangeFlow ? "Confirm exchange" : "Confirm completion";

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}
    >
      {/* Backdrop — does not dismiss on click; user has entered data */}
      <div className="fixed inset-0 agent-backdrop-overlay" />

      {/* Drawer panel */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          width: 460,
          maxWidth: "100vw",
          background: "rgba(255,250,247,0.98)",
          borderTop: "2px solid var(--agent-coral-deep)",
          borderLeft: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          animation: "agent-drawer-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header — Variant A */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "0.5px solid rgba(15,23,42,0.08)", flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Date inputs */}
          <div style={{ background: "rgba(15,23,42,0.03)", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
                {isExchangeFlow ? "Date contracts exchanged" : "Date sale completed"}
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="agent-focus"
                style={{ border: "0.5px solid rgba(15,23,42,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 14, width: "100%", background: "white", color: "rgba(15,23,42,0.85)" }}
              />
              <p style={{ fontSize: 11, color: "rgba(15,23,42,0.40)", marginTop: 4, marginBottom: 0 }}>Pre-filled with today — change if it was different</p>
            </div>
            {isExchangeFlow && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
                  Expected completion date{" "}
                  <span style={{ fontWeight: 400, color: "rgba(15,23,42,0.40)" }}>(optional)</span>
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="agent-focus"
                  style={{ border: "0.5px solid rgba(15,23,42,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 14, width: "100%", background: "white", color: "rgba(15,23,42,0.85)" }}
                />
              </div>
            )}
          </div>

          {/* Outstanding milestones */}
          {outstanding.length > 0 && (
            <div>
              <p className="agent-section-label" style={{ marginBottom: 4 }}>Steps not yet confirmed</p>
              <p style={{ fontSize: 12, color: "rgba(15,23,42,0.45)", marginBottom: 12, lineHeight: 1.6 }}>
                Tick the steps below that are done. We{"'"}ll check them off at exchange. Leave a step unticked to exclude it.
              </p>

              <div style={{ borderRadius: 8, border: "0.5px solid rgba(15,23,42,0.10)", overflow: "hidden", marginBottom: 8 }}>
                {(expanded ? outstanding : outstanding.slice(0, 5)).map((item, i) => (
                  <div
                    key={item.id}
                    style={{ padding: "10px 16px", borderBottom: i < (expanded ? outstanding : outstanding.slice(0, 5)).length - 1 ? "0.5px solid rgba(15,23,42,0.06)" : "none" }}
                  >
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        style={{ marginTop: 2, accentColor: "var(--agent-coral-deep)", flexShrink: 0 }}
                        checked={reconciledIds.has(item.id)}
                        onChange={(e) => {
                          setReconciledIds((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(item.id) : next.delete(item.id);
                            return next;
                          });
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, color: "rgba(15,23,42,0.80)" }}>{item.name}</span>
                        <span style={{ fontSize: 11, color: "rgba(15,23,42,0.40)" }}>{item.side === "vendor" ? "Vendor" : "Purchaser"}</span>
                      </span>
                    </label>
                    {item.eventDateRequired && reconciledIds.has(item.id) && (
                      <div style={{ marginTop: 8, marginLeft: 26 }}>
                        <label style={{ display: "block", fontSize: 11, color: "rgba(15,23,42,0.50)", marginBottom: 4 }}>
                          {getEventDateLabel(item.code)}{" "}
                          <span style={{ color: "rgba(15,23,42,0.35)" }}>(blank = exclude)</span>
                        </label>
                        <input
                          type="date"
                          value={reconciledDates[item.id] ?? ""}
                          onChange={(e) => setReconciledDates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="agent-focus"
                          style={{ border: "0.5px solid rgba(15,23,42,0.15)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 180, background: "white", color: "rgba(15,23,42,0.85)" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {outstanding.length > 5 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="agent-link-primary text-xs"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}
                >
                  {expanded ? "Show fewer" : `Show ${outstanding.length - 5} more`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — paired drawer pattern */}
        <div style={{ padding: "12px 24px 20px", borderTop: "0.5px solid rgba(15,23,42,0.08)", display: "flex", gap: 12, flexShrink: 0 }}>
          <button
            onClick={onCancel}
            style={{
              width: 96,
              padding: "10px 0",
              borderRadius: 12,
              background: "transparent",
              color: "rgba(15,23,42,0.55)",
              fontWeight: 500,
              fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="agent-btn-color-primary"
            style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            {title}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
