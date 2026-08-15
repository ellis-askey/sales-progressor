"use client";

// Shown when confirming the "survey booked" step on a file that requested
// survey quotes. Captures the survey date AND which surveyor the buyer booked,
// so we can flip the quote to booked and show the firm to everyone. If the
// buyer booked outside our list, or the agent isn't sure yet, that's captured
// too. Only rendered when there's at least one quote to choose from.

import { useState } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import type { SurveyBookingOption, SurveyBookingChoice } from "@/app/actions/survey-booking";

type Selection = { kind: "our_firm"; quoteRequestId: string } | { kind: "someone_else" } | { kind: "unknown" };

export function SurveyBookingModal({
  options,
  saving,
  onConfirm,
  onCancel,
}: {
  options: SurveyBookingOption[];
  saving: boolean;
  onConfirm: (surveyDate: string, choice: SurveyBookingChoice) => void;
  onCancel: () => void;
}) {
  const { theme } = usePortalTheme();
  const [surveyDate, setSurveyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selection, setSelection] = useState<Selection | null>(null);

  const canConfirm = !!surveyDate && selection !== null && !saving;

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: active ? "2px solid var(--agent-coral-deep, #FF6B4A)" : "1px solid rgba(15,23,42,0.12)",
    background: active ? "rgba(255,107,74,0.06)" : "white",
    cursor: "pointer",
    fontSize: 14,
    color: "rgba(15,23,42,0.85)",
  });

  return (
    <Modal open onClose={onCancel} ariaLabel="Confirm the survey booking" size="sm" dismissOnBackdrop={false} showCloseButton={false}>
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Modal.Header>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>
            Confirm the survey booking
          </p>
        </Modal.Header>

        <Modal.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.55)", marginBottom: 6 }}>
                When is the survey?
              </label>
              <input
                type="date"
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, color: "rgba(15,23,42,0.85)",
                  background: "white", outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.55)", marginBottom: 8 }}>
                Which surveyor did they book?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {options.map((o) => {
                  const active = selection?.kind === "our_firm" && selection.quoteRequestId === o.quoteRequestId;
                  return (
                    <button key={o.quoteRequestId} type="button" onClick={() => setSelection({ kind: "our_firm", quoteRequestId: o.quoteRequestId })} style={rowStyle(active)}>
                      <span style={{ fontWeight: 600 }}>{o.firmName}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => setSelection({ kind: "someone_else" })} style={rowStyle(selection?.kind === "someone_else")}>
                  Booked someone else (not on our list)
                </button>
                <button type="button" onClick={() => setSelection({ kind: "unknown" })} style={rowStyle(selection?.kind === "unknown")}>
                  Not sure yet
                </button>
              </div>
              {selection?.kind === "someone_else" && (
                <p style={{ fontSize: 12, color: "rgba(15,23,42,0.5)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  We&apos;ll mark our quotes as lost for this file.
                </p>
              )}
              {selection?.kind === "unknown" && (
                <p style={{ fontSize: 12, color: "rgba(15,23,42,0.5)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  We&apos;ll leave the quotes open. You can set the surveyor later.
                </p>
              )}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "0 20px 20px", gap: 12, justifyContent: undefined }}>
          <button
            onClick={onCancel}
            style={{
              width: 96, padding: "10px 0", borderRadius: 12, background: "transparent",
              color: "rgba(15,23,42,0.55)", fontWeight: 500, fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selection && onConfirm(surveyDate, selection)}
            disabled={!canConfirm}
            className="agent-btn-color-primary"
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14,
              border: "none", cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.5,
            }}
          >
            {saving ? "Confirming…" : "Confirm survey booked"}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
