"use client";

// "How do you want to stop?" chooser modal for the AutomationControls
// banner. Surfaces when the agent toggles automation OFF. Two-step:
//   1. Pick between "pause client emails" or "put on hold"
//   2. If hold was picked, ask for a planned return date — quick-picks
//      (7d / 14d / 30d), specific date, or "indefinitely"
//
// Returns the chosen plannedEndAt (Date or null for indefinitely) plus an
// optional free-text reason so the parent can pass both through to
// putFileOnHold. Pause path doesn't carry a date or reason; onPick fires
// with choice="pause" + plannedEndAt=null + reason=null.

import { useState } from "react";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";

type Choice = "pause" | "hold";

type Props = {
  onPick: (choice: Choice, plannedEndAt: Date | null, reason: string | null) => void;
  onClose: () => void;
  isPending: boolean;
  // When true the pause-vs-hold chooser is skipped and the modal opens
  // straight on the hold-date step. Used where email pausing is handled
  // elsewhere (the per-party EmailAudienceMenu), so this control is hold-only.
  holdOnly?: boolean;
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

export function AutomationStopModal({ onPick, onClose, isPending, holdOnly = false }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [step, setStep] = useState<"choose" | "hold-date">(holdOnly ? "hold-date" : "choose");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");

  function handleHoldIndefinite() {
    onPick("hold", null, reason.trim() || null);
  }
  function handleHoldCustom() {
    if (!customDate) return;
    const d = new Date(customDate);
    d.setHours(9, 0, 0, 0);
    onPick("hold", d, reason.trim() || null);
  }

  // Note: previously Escape on hold-date stepped back to "choose"; the
  // canonical Modal primitive's Escape always closes. Use the explicit
  // "Back" button on the hold-date step for in-modal back nav. Accepted
  // canonical shift.
  return (
    <Modal
      open={true}
      onClose={onClose}
      ariaLabel={step === "choose" ? "Stop automation on this file" : "When should we surface this again?"}
      size="md"
      zLayer="escalated"
    >
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
            {step === "choose" ? "Stop automation on this file" : "When should we surface this again?"}
          </p>
        </Modal.Header>

        {step === "choose" && (
          <>
            <Modal.Body>
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Pick one. You can always change later.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <ChooserCard
                  title="Pause client emails"
                  description="No automated chases will send. The team still sees reminders so they can chase manually. Chase clock keeps running."
                  onClick={() => onPick("pause", null, null)}
                  disabled={isPending}
                />
                <ChooserCard
                  title="Put file on hold"
                  description="Freezes everything: no emails, no reminders, no escalations until you reactivate."
                  onClick={() => setStep("hold-date")}
                  disabled={isPending}
                />
              </div>
            </Modal.Body>

            <Modal.Footer style={{ padding: "14px 20px 20px", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </Modal.Footer>
          </>
        )}

        {step === "hold-date" && (
          <>
            <Modal.Body>
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                We&apos;ll surface this file on the hub when the date arrives, so it doesn&apos;t get forgotten.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", display: "block", marginBottom: 6 }}>
                    Pick a return date
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
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
                      {holdOnly ? "Pause this sale" : "Put on hold"}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", display: "block", marginBottom: 6 }}>
                    Reason <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="Waiting for buyer searches, probate, chain issue…"
                    className="glass-input"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 13 }}
                  />
                </div>

                <div style={{ borderTop: "0.5px solid rgba(15,23,42,0.08)", paddingTop: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleHoldIndefinite}
                    disabled={isPending}
                    className="agent-link"
                    style={{ fontSize: 12, color: "var(--agent-text-muted)", textAlign: "left", padding: "4px 0" }}
                  >
                    {holdOnly ? "Or pause indefinitely (won" : "Or hold indefinitely (won"}&apos;t auto-surface)
                  </button>
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer style={{ padding: "14px 20px 20px", justifyContent: "space-between" }}>
              <button
                onClick={() => (holdOnly ? onClose() : setStep("choose"))}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                {holdOnly ? "Cancel" : "← Back"}
              </button>
              {!holdOnly && (
                <button
                  onClick={onClose}
                  className="agent-link"
                  style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
                >
                  Cancel
                </button>
              )}
            </Modal.Footer>
          </>
        )}
      </div>
    </Modal>
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
        <LinkArrow size={14} />
      </span>
    </button>
  );
}
