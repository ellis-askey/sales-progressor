"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, CalendarBlank } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

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

// The sign-up T&C tick, as a non-interactive "included" marker. Every
// outstanding step is confirmed at exchange (by exchange, everything before it
// has happened), so this reads as "included", not a control.
function IncludedTick() {
  return (
    <span
      aria-hidden
      style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--agent-coral-deep)", border: "1.5px solid var(--agent-coral-deep)",
      }}
    >
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

// "24 Sept 2026" from a yyyy-mm-dd value, built in local time so it never
// slips a day across time zones.
const CHIP_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
function fmtChipDate(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return v;
  return CHIP_FMT.format(new Date(y, m - 1, d));
}

// One step in the summary: an included marker + name. The date is optional and
// lives behind a calendar button that opens the picker directly — no empty
// field ever shows. Once a date is chosen it appears as a chip (change / clear).
function ReconStepRow({
  item, value, onChange, last,
}: {
  item: ReconciliationItem;
  value: string;
  onChange: (v: string) => void;
  last: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function pick() {
    try { ref.current?.showPicker?.(); } catch { ref.current?.focus?.(); }
  }
  const formatted = value ? fmtChipDate(value) : null;

  return (
    <div style={{ padding: "11px 14px", borderBottom: last ? "none" : "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 11 }}>
      <IncludedTick />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--agent-text-primary)" }}>{item.name}</span>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
        {/* Hidden native input — kept mounted so the picker opens on click; holds
            the value. Visually hidden, never tab-focused (the buttons are). */}
        <input
          ref={ref}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Date for ${item.name} (optional)`}
          tabIndex={-1}
          style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0, margin: 0 }}
        />
        {formatted ? (
          <span className="recon-date-chip">
            <button type="button" onClick={pick} className="recon-date-chip-val" title="Change date">{formatted}</button>
            <button type="button" onClick={() => onChange("")} aria-label="Clear date" className="recon-date-chip-x">
              <X size={11} weight="bold" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={pick}
            aria-label={`Add a date for ${item.name}`}
            className="recon-cal-btn"
          >
            <CalendarBlank size={16} weight="regular" />
          </button>
        )}
      </span>
    </div>
  );
}

// Neutral date field for the two primary dates (exchange / completion). Shows
// the date in the same friendly format as the step chips, but styled as a plain
// field (no coral) — opens the native picker on click, no raw dd/mm/yyyy box.
function DateField({
  value, onChange, ariaLabel, placeholder = "Select a date",
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function pick() { try { ref.current?.showPicker?.(); } catch { ref.current?.focus?.(); } }
  const formatted = value ? fmtChipDate(value) : null;
  return (
    <span style={{ position: "relative", display: "block" }}>
      {/* Hidden native input — anchors + opens the picker; holds the value. */}
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        tabIndex={-1}
        style={{ position: "absolute", left: 12, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0, margin: 0 }}
      />
      {/* Border / background / hover / focus live in the .recon-datefield CSS so
          the pseudo-classes aren't overridden by inline styles. */}
      <button type="button" onClick={pick} className={`recon-datefield${formatted ? "" : " is-empty"}`}>
        <span>{formatted ?? placeholder}</span>
        <CalendarBlank size={16} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
      </button>
    </span>
  );
}

export function ReconciliationDrawer({
  isExchangeFlow,
  outstanding,
  initialEventDate,
  pendingEventDate,
  onConfirm,
  onCancel,
}: ReconciliationDrawerProps) {
  const { theme, isNight } = usePortalTheme();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function doClose() {
    if (!closing) {
      setClosing(true);
      closeTimer.current = setTimeout(onCancel, 200);
    }
  }
  useOverlayChrome(doClose);

  const [eventDate, setEventDate] = useState(initialEventDate);
  const [completionDate, setCompletionDate] = useState("");
  // Per-step optional event date. A step left blank is still confirmed — just
  // marked complete on the exchange date rather than a specific earlier one.
  const [reconciledDates, setReconciledDates] = useState<Record<string, string>>({});

  const title = isExchangeFlow ? "Confirm exchange" : "Confirm completion";
  const eventWord = isExchangeFlow ? "exchange" : "completion";
  const total = outstanding.length;
  const stepsPhrase = `${total} earlier step${total === 1 ? "" : "s"}`;

  function handleConfirm() {
    onConfirm(
      eventDate || pendingEventDate,
      outstanding.map((m) => m.id),
      Object.fromEntries(Object.entries(reconciledDates).filter(([, v]) => !!v)),
      completionDate || undefined
    );
  }

  // Group by side, purchaser first (matches the mock order).
  const groups: { label: string; items: ReconciliationItem[] }[] = [
    { label: "Purchaser", items: outstanding.filter((m) => m.side === "purchaser") },
    { label: "Vendor", items: outstanding.filter((m) => m.side === "vendor") },
  ].filter((g) => g.items.length > 0);

  return createPortal(
    <div
      data-theme={theme} data-night={isNight ? "" : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}
    >
      {/* Backdrop — does not dismiss on click; the agent has entered data */}
      <div className="fixed inset-0 agent-backdrop-overlay" />

      {/* Drawer panel — 460 on desktop/tablet, full width on mobile */}
      <div
        style={{
          position: "relative", zIndex: 1, height: "100%", width: 460, maxWidth: "100vw",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header — no eyebrow */}
        <div style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "center", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SheetBandHeader
              title={title}
              subtitle={isExchangeFlow ? "Set the exchange date and tidy up any outstanding steps." : "Confirm the date this sale completed."}
            />
          </div>
          <button
            onClick={doClose}
            aria-label="Close"
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ color: "rgba(255,255,255,0.85)", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px 24px" }}>

          {/* Dates — 2-up on desktop/tablet, stacks on mobile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isExchangeFlow ? "repeat(auto-fit, minmax(min(100%, 190px), 1fr))" : "1fr",
              gap: 16,
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 2 }}>
                {isExchangeFlow ? "Exchange date" : "Completion date"}
              </label>
              <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
                {isExchangeFlow ? "Enter the date contracts were exchanged." : "Enter the date the sale completed."}
              </p>
              <DateField
                value={eventDate}
                onChange={setEventDate}
                ariaLabel={isExchangeFlow ? "Exchange date" : "Completion date"}
              />
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "6px 0 0" }}>Set to today. Change if it was different.</p>
            </div>
            {isExchangeFlow && (
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 2 }}>
                  Expected completion
                </label>
                <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
                  Add the expected completion date, if known.
                </p>
                <DateField
                  value={completionDate}
                  onChange={setCompletionDate}
                  ariaLabel="Expected completion date"
                />
              </div>
            )}
          </div>

          {/* Outstanding steps — a calm summary of what else gets marked done,
              not a form. Each row optionally takes a date behind the calendar. */}
          {total > 0 && (
            <>
              <div style={{ height: 1, background: "var(--agent-border-subtle)", margin: "22px 0 16px" }} aria-hidden />

              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
                Confirming {eventWord} will also mark{" "}
                <strong style={{ color: "var(--agent-text-primary)", fontWeight: 700 }}>{stepsPhrase}</strong>
                {" "}complete on the {eventWord} date. Add a date to any that happened on a different day.
              </p>

              {groups.map((group) => (
                <div key={group.label} style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                    {group.label}
                  </p>
                  <div style={{ borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)", overflow: "hidden" }}>
                    {group.items.map((item, i) => (
                      <ReconStepRow
                        key={item.id}
                        item={item}
                        value={reconciledDates[item.id] ?? ""}
                        onChange={(v) => setReconciledDates((prev) => ({ ...prev, [item.id]: v }))}
                        last={i === group.items.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer — paired drawer pattern */}
        <div style={{ padding: "12px 24px 20px", borderTop: "0.5px solid var(--agent-border-subtle)", display: "flex", gap: 12, flexShrink: 0 }}>
          <button
            type="button"
            onClick={doClose}
            className="agent-btn agent-btn-neutral"
            style={{ width: 96, borderRadius: 12, fontSize: 14 }}
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

      <style>{`
        .recon-datefield {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
          border: 0.5px solid var(--agent-border-default); border-radius: 8px; padding: 9px 12px;
          background: #fff; cursor: pointer; text-align: left; font-size: 14px; font-variant-numeric: tabular-nums;
          color: var(--agent-text-primary); transition: border-color 140ms;
        }
        [data-night] .recon-datefield { background: rgba(30, 41, 59, 0.85); }
        .recon-datefield.is-empty { color: var(--agent-text-muted); }
        .recon-datefield:hover { border-color: var(--agent-coral); }
        .recon-datefield:focus, .recon-datefield:focus-visible { outline: none; border-color: var(--agent-coral-deep); }
        .recon-cal-btn {
          width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 0.5px solid var(--agent-border-default);
          color: var(--agent-text-muted); transition: border-color 140ms, color 140ms;
        }
        .recon-cal-btn:hover { border-color: var(--agent-coral); color: var(--agent-text-secondary); }
        .recon-cal-btn:focus, .recon-cal-btn:focus-visible, .recon-cal-btn:active { outline: none; border-color: var(--agent-coral-deep); color: var(--agent-coral-deep); }
        .recon-date-chip {
          display: inline-flex; align-items: center; gap: 2px;
          background: rgba(var(--agent-coral-rgb), 0.10);
          border: 0.5px solid rgba(var(--agent-coral-rgb), 0.30);
          border-radius: 8px; padding: 2px 3px 2px 4px;
          animation: recon-chip-in 180ms cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .recon-date-chip-val {
          background: none; border: none; cursor: pointer;
          font-size: 12.5px; font-weight: 600; color: var(--agent-coral-deep);
          padding: 3px 6px; border-radius: 6px; font-variant-numeric: tabular-nums;
          transition: background 120ms;
        }
        .recon-date-chip-val:hover { background: rgba(var(--agent-coral-rgb), 0.14); }
        .recon-date-chip-x {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border: none; background: none; cursor: pointer;
          color: var(--agent-coral-deep); border-radius: 5px; opacity: 0.7; transition: opacity 120ms, background 120ms;
        }
        .recon-date-chip-x:hover { opacity: 1; background: rgba(var(--agent-coral-rgb), 0.14); }
        @keyframes recon-chip-in { from { opacity: 0; transform: translateY(2px) scale(0.94); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .recon-date-chip { animation: none; } }
      `}</style>
    </div>,
    document.body
  );
}
