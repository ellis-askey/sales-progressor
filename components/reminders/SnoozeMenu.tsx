"use client";

// Shared snooze popover for every reminder surface (Reminders page rows +
// "Snooze all", and the property-file Reminders tab). Replaces the three
// near-identical bespoke menus that only offered quick durations.
//
// Adds: an optional reason (logged against the reminder + posted to the file's
// Activity tab by the snooze action), and a "pick a date" alternative to the
// quick gaps. The reason input means the popover holds focus, so it tracks
// clicks on BOTH the trigger and its own portal content before closing — a
// plain outside-click check would dismiss it the moment you clicked the field.

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { DateField } from "@/components/ui/DateField";

export interface SnoozeChoice {
  hours?: number;
  untilISO?: string;
  reason: string | null;
}

const QUICK = [
  { label: "24 h", hours: 24 },
  { label: "48 h", hours: 48 },
  { label: "72 h", hours: 72 },
  { label: "7 days", hours: 168 },
];

// Estimated popover height, used only to decide whether it opens above or below
// the trigger. Being a little off just biases the flip; it doesn't clip.
const MENU_H = 300;

export function SnoozeMenu({
  onConfirm,
  disabled,
  variant = "row",
  label = "Snooze all",
  count,
}: {
  onConfirm: (choice: SnoozeChoice) => void;
  disabled?: boolean;
  variant?: "row" | "all";
  label?: string;
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; above: boolean } | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [dateVal, setDateVal] = useState("");
  const [reason, setReason] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function close() { setClosing(true); setOpen(false); }
  function reset() { setHours(null); setDateVal(""); setReason(""); }

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (contentRef.current?.contains(t)) return;
      close();
    }
    function handleScroll() { close(); }
    if (open) {
      document.addEventListener("mousedown", handle);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function openMenu() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const above = window.innerHeight - r.bottom < MENU_H;
    setPos({
      top: above ? r.top - 4 : r.bottom + 4,
      right: window.innerWidth - r.right,
      above,
    });
    reset();
    setClosing(false);
    setOpen(true);
  }

  function confirm() {
    if (!hours && !dateVal) return;
    onConfirm(dateVal ? { untilISO: dateVal, reason: reason.trim() || null } : { hours: hours ?? 24, reason: reason.trim() || null });
    close();
  }

  const canConfirm = !!hours || !!dateVal;

  return (
    <div className="relative" ref={triggerRef}>
      <Button
        onClick={() => (open ? close() : openMenu())}
        disabled={disabled}
        title="Snooze"
        variant={variant === "all" ? "ghost" : "secondary"}
        size="sm"
        className="rem-clock-btn"
        style={{ flexShrink: 0, whiteSpace: "nowrap" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <line x1="12" y1="12" x2="15" y2="12" />
          <g className="rem-clock-hand"><line x1="12" y1="12" x2="12" y2="6.5" /></g>
        </svg>
        {variant === "all" ? ` ${label}${count ? ` (${count})` : ""}` : null}
      </Button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed", top: pos.top, right: pos.right,
            transform: pos.above ? "translateY(-100%)" : "none",
            zIndex: 9999,
          }}
        >
          <div
            ref={contentRef}
            data-theme={theme}
            className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
            onAnimationEnd={() => { if (closing) setClosing(false); }}
            style={{
              background: "var(--agent-menu-surface, #ffffff)", borderRadius: 14, overflow: "hidden",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)", border: "0.5px solid var(--agent-border-default)",
              width: 232, padding: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--agent-text-muted)", textTransform: "uppercase" }}>
              Snooze until
            </p>

            {/* Quick gaps */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {QUICK.map((opt) => {
                const on = hours === opt.hours && !dateVal;
                return (
                  <button
                    key={opt.hours}
                    onClick={() => { setHours(opt.hours); setDateVal(""); }}
                    className={`rem-snz-chip${on ? " on" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Or a specific date */}
            <DateField
              value={dateVal}
              min={tomorrow}
              onChange={(e) => { setDateVal(e.target.value); setHours(null); }}
              className="agent-input agent-input-sm"
              style={{ width: "100%", fontSize: 12 }}
              wrapperStyle={{ marginBottom: 8 }}
            />

            {/* Optional reason */}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (optional)"
              rows={2}
              className="agent-textarea"
              style={{ width: "100%", fontSize: 12, resize: "none", marginBottom: 10, lineHeight: 1.4, minHeight: 52, padding: "8px 10px" }}
            />

            <Button onClick={confirm} disabled={!canConfirm} size="sm" style={{ width: "100%" }}>
              Snooze{count && count > 1 ? ` all ${count}` : ""}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
