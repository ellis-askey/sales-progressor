"use client";

// Move an already-confirmed survey / lender-valuation to a new date, without
// undoing and re-confirming the step. Opened from the completed booking row on
// the Steps tab. The save fires changeBookingDateAction, which updates the
// stored date, tells the agent it moved, and lets the morning-of reminder
// re-target the new day on its own.

import { useRef, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
function fmtDate(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return "Choose a date";
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  function open() {
    const el = ref.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); }
  }
  return (
    <button type="button" className="cbd-datefield" onClick={open}>
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

export function ChangeBookingDateModal({
  currentDate,
  noun,
  saving,
  onConfirm,
  onCancel,
}: {
  currentDate: string; // yyyy-mm-dd (the current booked date)
  noun: string; // "survey" | "lender valuation"
  saving: boolean;
  onConfirm: (newDate: string) => void;
  onCancel: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  const [date, setDate] = useState<string>(currentDate);

  const canSave = !!date && date !== currentDate && !saving;

  return (
    <Modal open onClose={onCancel} ariaLabel={`Change the ${noun} date`} size="sm" dismissOnBackdrop={!saving} showCloseButton={false} closeTone="onDark">
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader title={`Change the ${noun} date`} subtitle="We'll let the agent know it's moved." />
        </Modal.Header>

        <Modal.Body>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
            New date
          </label>
          <DateField value={date} onChange={setDate} />
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "10px 0 0", lineHeight: 1.5 }}>
            The morning-of reminder will move with it. Nothing is re-sent to the client.
          </p>
        </Modal.Body>

        <Modal.Footer style={{ padding: "16px 20px 20px", gap: 12, justifyContent: undefined }}>
          <button type="button" onClick={onCancel} disabled={saving} className="agent-btn agent-btn-neutral agent-btn-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (canSave) onConfirm(date); }}
            disabled={!canSave}
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : "Change date"}
          </button>
        </Modal.Footer>
      </div>

      <style>{`
        .cbd-datefield {
          position: relative;
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--agent-border-default);
          background: transparent; cursor: pointer; font-size: 14px;
          transition: border-color 150ms ease;
        }
        .cbd-datefield:hover { border-color: var(--agent-coral); }
        .cbd-datefield:focus-visible { outline: none; border-color: var(--agent-coral-deep); }
      `}</style>
    </Modal>
  );
}
