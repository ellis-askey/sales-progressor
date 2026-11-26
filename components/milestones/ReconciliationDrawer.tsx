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
  // True while the parent's confirm action is in flight. Disables the controls,
  // shows a "Confirming…" state, and blocks dismissal so the heavy exchange
  // confirm isn't a silent wait and can't be interrupted mid-write.
  saving?: boolean;
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
  const formatted = value ? fmtChipDate(value) : null;
  // A transparent native date input overlaid on the affordance, so a tap opens
  // the native picker on every device (the old showPicker()-only click did
  // nothing on mobile browsers without showPicker). showPicker stays as a
  // desktop click nicety.
  const overlayInput = (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch { /* native tap handles it */ } }}
      aria-label={formatted ? `Change date for ${item.name}` : `Add a date for ${item.name} (optional)`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0, margin: 0 }}
    />
  );

  return (
    <div style={{ padding: "11px 14px", borderBottom: last ? "none" : "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 11 }}>
      <IncludedTick />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--agent-text-primary)" }}>{item.name}</span>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
        {formatted ? (
          <span className="recon-date-chip">
            {/* Value acts as the "change" affordance — input overlays only it, so
                the clear X beside it stays independently tappable. */}
            <span style={{ position: "relative", display: "inline-flex" }} title="Change date">
              <span className="recon-date-chip-val">{formatted}</span>
              {overlayInput}
            </span>
            <button type="button" onClick={() => onChange("")} aria-label="Clear date" className="recon-date-chip-x">
              <X size={11} weight="bold" />
            </button>
          </span>
        ) : (
          <span style={{ position: "relative", display: "inline-flex" }}>
            <span className="recon-cal-btn" aria-hidden="true">
              <CalendarBlank size={16} weight="regular" />
            </span>
            {overlayInput}
          </span>
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
  const formatted = value ? fmtChipDate(value) : null;
  return (
    <span className="recon-datefield-wrap" style={{ position: "relative", display: "block" }}>
      {/* The visual pill (non-interactive). Border / background / hover / focus
          live in the .recon-datefield CSS. */}
      <span className={`recon-datefield${formatted ? "" : " is-empty"}`} aria-hidden="true">
        <span>{formatted ?? placeholder}</span>
        <CalendarBlank size={16} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
      </span>
      {/* The REAL native input, transparent, filling the pill. Tapping it opens
          the native date picker on every device — the old showPicker()-only
          button did nothing on mobile browsers without showPicker (the field
          "did nothing" on phones). Mirrors the canonical components/ui/DateField
          mobile approach; showPicker stays as a desktop click nicety. */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch { /* native tap handles it */ } }}
        aria-label={ariaLabel}
        className="recon-datefield-input"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0, margin: 0 }}
      />
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
  saving = false,
}: ReconciliationDrawerProps) {
  const { theme, isNight } = usePortalTheme();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function doClose() {
    if (saving) return; // don't let the drawer be dismissed mid-confirm
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
  const stepsPhrase = `${total} outstanding milestone${total === 1 ? "" : "s"}`;
  // Nothing to reconcile → a compact centred modal (a full-height drawer is
  // overkill for a single date). Any outstanding steps → keep the drawer, which
  // needs the height for the scrollable list.
  const asModal = total === 0;

  function handleConfirm() {
    if (saving) return;
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
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", justifyContent: asModal ? "center" : "flex-end", alignItems: asModal ? "center" : "stretch", padding: asModal ? 20 : 0 }} /* escalated layer — clears the agent topbar (200), critique #292 */
    >
      {/* Backdrop — does not dismiss on click; the agent has entered data */}
      <div className={`fixed inset-0 agent-backdrop-overlay${closing ? " agent-backdrop-closing" : ""}`} onClick={doClose} />

      {/* Panel — a centred modal when there's nothing to reconcile, otherwise
          the right-hand drawer (460 on desktop/tablet, full width on mobile). */}
      <div
        style={asModal ? {
          position: "relative", zIndex: 1,
          width: 460, maxWidth: "calc(100vw - 40px)", maxHeight: "calc(100vh - 40px)",
          background: "var(--agent-surface-elevated)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
          animation: closing
            ? "agent-search-out 180ms ease-in both"
            : "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex", flexDirection: "column", overflow: "hidden",
        } : {
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
              subtitle={isExchangeFlow ? "Record the exchange and update any outstanding milestones." : "Confirm the date this sale completed."}
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
        <div style={{ ...(asModal ? {} : { flex: 1 }), overflowY: "auto", padding: "22px 24px 24px" }}>

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
                {isExchangeFlow ? "When were contracts exchanged?" : "When did the sale complete?"}
              </p>
              <DateField
                value={eventDate}
                onChange={setEventDate}
                ariaLabel={isExchangeFlow ? "Exchange date" : "Completion date"}
              />
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "6px 0 0" }}>Set to today by default.</p>
            </div>
            {isExchangeFlow && (
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 2 }}>
                  Expected completion
                </label>
                <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
                  When is completion expected?
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

              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                Outstanding milestones
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--agent-text-primary)", fontWeight: 700 }}>{stepsPhrase}</strong>
                {" "}will be completed automatically using the {eventWord} date. You can adjust their dates below.
              </p>

              {groups.map((group) => (
                <div key={group.label} style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--agent-text-muted)" }}>
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
            disabled={saving}
            className="agent-btn agent-btn-neutral"
            style={{ width: 96, borderRadius: 12, fontSize: 14, ...(saving ? { opacity: 0.5, cursor: "default" } : {}) }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            aria-busy={saving || undefined}
            className="agent-btn-color-primary"
            style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: saving ? "default" : "pointer", ...(saving ? { opacity: 0.85 } : {}) }}
          >
            {saving ? "Confirming…" : title}
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
        /* Hover/focus live on the wrapper — the native input sits on top of the
           pill, so the pill itself never receives :hover / :focus directly. */
        .recon-datefield-wrap:hover .recon-datefield { border-color: var(--agent-coral); }
        .recon-datefield-wrap:focus-within .recon-datefield { outline: none; border-color: var(--agent-coral-deep); }
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
          /* Solid coral gradient fill — the house coral gradient (stage discs /
             primary buttons), so an entered date reads as a confident pill. */
          background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%);
          border: none;
          border-radius: 8px; padding: 2px 3px 2px 4px;
          box-shadow: 0 1px 2px rgba(var(--agent-coral-rgb), 0.35);
          animation: recon-chip-in 180ms cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .recon-date-chip-val {
          background: none; border: none; cursor: pointer;
          font-size: 12.5px; font-weight: 600; color: #fff;
          padding: 3px 6px; border-radius: 6px; font-variant-numeric: tabular-nums;
          transition: background 120ms;
        }
        .recon-date-chip-val:hover { background: rgba(255,255,255,0.18); }
        .recon-date-chip-x {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border: none; background: none; cursor: pointer;
          color: #fff; border-radius: 5px; opacity: 0.85; transition: opacity 120ms, background 120ms;
        }
        .recon-date-chip-x:hover { opacity: 1; background: rgba(255,255,255,0.18); }
        @keyframes recon-chip-in { from { opacity: 0; transform: translateY(2px) scale(0.94); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .recon-date-chip { animation: none; } }
      `}</style>
    </div>,
    document.body
  );
}
