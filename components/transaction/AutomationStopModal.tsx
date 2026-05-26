"use client";

// "How do you want to stop?" chooser modal for the AutomationControls
// banner. Surfaces when the agent toggles automation OFF. Two-step:
//   1. Pick between "pause client emails" or "put on hold"
//   2. If hold was picked, ask for a planned return date — quick-picks
//      (7d / 14d / 30d), specific date, or "indefinitely"
//
// Returns the chosen plannedEndAt (Date or null for indefinitely) so the
// parent can pass it through to putFileOnHold. Pause path doesn't carry a
// date; onPick fires with choice="pause" + plannedEndAt=null.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Choice = "pause" | "hold";

type Props = {
  onPick: (choice: Choice, plannedEndAt: Date | null) => void;
  onClose: () => void;
  isPending: boolean;
};

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // 09:00 UK-ish; precision not important for a "come back to this" date
  return d;
}

function formatDateInput(d: Date): string {
  // yyyy-mm-dd for <input type="date">
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AutomationStopModal({ onPick, onClose, isPending }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [step, setStep] = useState<"choose" | "hold-date">("choose");
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (step === "hold-date") setStep("choose");
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  function handleHoldQuickPick(days: number) {
    onPick("hold", addDays(days));
  }
  function handleHoldIndefinite() {
    onPick("hold", null);
  }
  function handleHoldCustom() {
    if (!customDate) return;
    const d = new Date(customDate);
    d.setHours(9, 0, 0, 0);
    onPick("hold", d);
  }

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
            {step === "choose" ? "Stop automation on this file" : "When should we surface this again?"}
          </p>
          <button onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        {step === "choose" && (
          <>
            <div style={{ padding: "14px 20px 4px" }}>
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Pick one — you can always change later.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <ChooserCard
                  title="Pause client emails"
                  description="No automated chases will send. The team still sees reminders so they can chase manually. Chase clock keeps running."
                  onClick={() => onPick("pause", null)}
                  disabled={isPending}
                />
                <ChooserCard
                  title="Put file on hold"
                  description="Freezes everything — no emails, no reminders, no escalations until you reactivate."
                  onClick={() => setStep("hold-date")}
                  disabled={isPending}
                />
              </div>
            </div>

            <div style={{ padding: "14px 20px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "hold-date" && (
          <>
            <div style={{ padding: "14px 20px 4px" }}>
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                We&apos;ll surface this file on the hub when the date arrives — so it doesn&apos;t get forgotten.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                <QuickPick label="7 days from now"  onClick={() => handleHoldQuickPick(7)}  disabled={isPending} />
                <QuickPick label="14 days from now" onClick={() => handleHoldQuickPick(14)} disabled={isPending} />
                <QuickPick label="30 days from now" onClick={() => handleHoldQuickPick(30)} disabled={isPending} />

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={formatDateInput(addDays(1))}
                    className="glass-input"
                    style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={handleHoldCustom}
                    disabled={isPending || !customDate}
                    className="agent-btn agent-btn-sm agent-btn-primary"
                  >
                    Use this date
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleHoldIndefinite}
                  disabled={isPending}
                  className="agent-link"
                  style={{ marginTop: 4, fontSize: 12, color: "var(--agent-text-muted)", textAlign: "left", padding: "8px 6px" }}
                >
                  Or hold indefinitely (won&apos;t auto-surface)
                </button>
              </div>
            </div>

            <div style={{ padding: "14px 20px 20px", display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => setStep("choose")}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                ← Back
              </button>
              <button
                onClick={onClose}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
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

function QuickPick({
  label,
  onClick,
  disabled,
}: {
  label: string;
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
        padding: "10px 14px",
        background: "var(--agent-surface-glass)",
        border: "0.5px solid rgba(15,23,42,0.10)",
        borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: 13,
        fontWeight: 500,
        color: "var(--agent-text-primary)",
        transition: "background 150ms, border-color 150ms",
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
      {label}
    </button>
  );
}
