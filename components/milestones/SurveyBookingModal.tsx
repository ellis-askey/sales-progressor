"use client";

// Shown when confirming the "survey booked" step on a file that requested
// survey quotes. Captures the survey date AND which surveyor the buyer booked,
// so we can flip the quote to booked and show the firm to everyone. If the
// buyer booked outside our list, or the agent isn't sure yet, that's captured
// too. Only rendered when there's at least one quote to choose from.

import { useRef, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import type { SurveyBookingOption, SurveyBookingChoice } from "@/lib/services/survey-booking";

type Selection = { kind: "our_firm"; quoteRequestId: string } | { kind: "someone_else" } | { kind: "unknown" };

// "10 Sept 2026" from a yyyy-mm-dd value, built in local time so it never
// slips a day across time zones.
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
function fmtDate(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return "Choose a date";
  return DATE_FMT.format(new Date(y, m - 1, d));
}

// Nicely-presented date field: shows the formatted date (or "Choose a date")
// and opens the native picker directly — no raw dd/mm/yyyy input on show.
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  function open() {
    const el = ref.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); }
  }
  return (
    <button type="button" className="sb-datefield" onClick={open}>
      <span style={{ color: value ? "var(--agent-text-primary)" : "var(--agent-text-muted)" }}>
        {value ? fmtDate(value) : "Choose a date"}
      </span>
      <CalendarBlank size={18} weight="regular" style={{ flexShrink: 0, color: "var(--agent-text-muted)" }} />
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
      />
    </button>
  );
}

// Our common tick — coral-deep box + white check that springs in.
function CheckTick({ on }: { on: boolean }) {
  return (
    <span className="sb-check" data-on={on ? "true" : undefined} aria-hidden>
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

export function SurveyBookingModal({
  options,
  saving,
  onConfirm,
  onCancel,
}: {
  options: SurveyBookingOption[];
  saving: boolean;
  onConfirm: (surveyDate: string, choice: SurveyBookingChoice, keyCollectionRequired: boolean) => void;
  onCancel: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  const [surveyDate, setSurveyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [otherFirmName, setOtherFirmName] = useState("");
  const [keyCollection, setKeyCollection] = useState(false);

  const canConfirm = !!surveyDate && selection !== null && !saving;

  return (
    <Modal open onClose={onCancel} ariaLabel="Confirm the survey booking" size="sm" dismissOnBackdrop={false} showCloseButton={false} closeTone="onDark">
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader title="Confirm the survey booking" subtitle="Record the survey date and who the buyer booked." />
        </Modal.Header>

        <Modal.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
                When is the survey?
              </label>
              <DateField value={surveyDate} onChange={setSurveyDate} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 8 }}>
                Which surveyor did they book?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {options.map((o) => {
                  const active = selection?.kind === "our_firm" && selection.quoteRequestId === o.quoteRequestId;
                  return (
                    <button key={o.quoteRequestId} type="button" className="sb-opt" data-on={active ? "true" : undefined} onClick={() => setSelection({ kind: "our_firm", quoteRequestId: o.quoteRequestId })}>
                      <span style={{ fontWeight: 600 }}>{o.firmName}</span>
                    </button>
                  );
                })}
                <button type="button" className="sb-opt" data-on={selection?.kind === "someone_else" ? "true" : undefined} onClick={() => setSelection({ kind: "someone_else" })}>
                  Booked someone else (not on our list)
                </button>
                {selection?.kind === "someone_else" && (
                  <input
                    type="text"
                    value={otherFirmName}
                    onChange={(e) => setOtherFirmName(e.target.value)}
                    placeholder="Surveyor's name (optional)"
                    className="sb-text-input"
                  />
                )}
                <button type="button" className="sb-opt" data-on={selection?.kind === "unknown" ? "true" : undefined} onClick={() => setSelection({ kind: "unknown" })}>
                  Not sure yet
                </button>
              </div>
              {selection?.kind === "someone_else" && (
                <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  We&apos;ll mark our quotes as lost for this file.
                </p>
              )}
              {selection?.kind === "unknown" && (
                <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  We&apos;ll leave the quotes open. You can set the surveyor later.
                </p>
              )}
            </div>

            <label
              className="sb-check-row"
              title="Tick if the surveyor collects keys from the branch. Leave it clear if they go straight to the property."
            >
              <input type="checkbox" checked={keyCollection} onChange={(e) => setKeyCollection(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
              <CheckTick on={keyCollection} />
              <span style={{ fontSize: 14, color: "var(--agent-text-primary)" }}>Surveyor collecting keys from us</span>
            </label>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "16px 20px 20px", gap: 12, justifyContent: undefined }}>
          <button type="button" onClick={onCancel} className="agent-btn agent-btn-ghost-bordered agent-btn-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selection) return;
              const choice: SurveyBookingChoice = selection.kind === "someone_else"
                ? { kind: "someone_else", firmName: otherFirmName.trim() || undefined }
                : selection;
              onConfirm(surveyDate, choice, keyCollection);
            }}
            disabled={!canConfirm}
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ flex: 1 }}
          >
            {saving ? "Confirming…" : "Confirm survey booked"}
          </button>
        </Modal.Footer>
      </div>

      <style>{`
        .sb-datefield {
          position: relative;
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--agent-border-default);
          background: transparent; cursor: pointer; font-size: 14px;
          transition: border-color 150ms ease;
        }
        .sb-datefield:hover { border-color: var(--agent-coral); }
        .sb-datefield:focus-visible { outline: none; border-color: var(--agent-coral-deep); }
        .sb-opt {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 11px 12px; border-radius: 10px;
          border: 1.5px solid var(--agent-border-default);
          background: transparent; cursor: pointer;
          font-size: 14px; color: var(--agent-text-primary);
          transition: border-color 150ms ease;
        }
        .sb-opt:hover { border-color: var(--agent-coral); }
        .sb-opt[data-on="true"], .sb-opt[data-on="true"]:hover { border-color: var(--agent-coral-deep); }
        .sb-text-input {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--agent-border-default);
          background: transparent; font-size: 14px; color: var(--agent-text-primary);
          outline: none; transition: border-color 150ms ease;
        }
        .sb-text-input:hover { border-color: var(--agent-coral); }
        .sb-text-input:focus { border-color: var(--agent-coral-deep); }
        .sb-check-row {
          display: flex; align-items: center; gap: 10px;
          cursor: pointer; user-select: none; position: relative;
        }
        .sb-check {
          flex-shrink: 0;
          width: 20px; height: 20px; border-radius: 6px;
          border: 1.5px solid var(--agent-border-strong, rgba(15,23,42,0.28));
          background: transparent;
          display: grid; place-items: center;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .sb-check[data-on="true"] { background: var(--agent-coral-deep); border-color: var(--agent-coral-deep); }
        .sb-check svg {
          opacity: 0; transform: scale(0.5);
          transition: opacity 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sb-check[data-on="true"] svg { opacity: 1; transform: scale(1); }
        @media (prefers-reduced-motion: reduce) {
          .sb-check svg { transition: opacity 120ms ease; }
        }
      `}</style>
    </Modal>
  );
}
