"use client";

// The reminders "Deck" primary action: a Chase split-button. The main button
// chases (opens the chase drawer); the attached chevron opens a small menu with
// the two secondary actions that used to sit inline — Mark chased and Mark done.
// Snooze stays a separate button. Purely a reorganisation of the same actions;
// no behaviour changes. Menu matches the hub's RowActionMenu (agent-menu-surface
// + agent-hover-row items + coral-deep icons). Styling in agent-system.css
// (.rem-chase*). Used by AgentRemindersList.
//
// `solo` renders just the chase button (no chevron/menu) for the file-level
// "Chase all", which has no per-task mark-chased/done.

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown, ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

export function ChaseSplitButton({
  label = "Chase",
  onChase,
  onMarkChased,
  onMarkDone,
  disabled = false,
  solo = false,
}: {
  label?: string;
  onChase: () => void;
  onMarkChased?: () => void;
  onMarkDone?: () => void;
  disabled?: boolean;
  solo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme } = usePortalTheme();

  function close() { setClosing(true); setOpen(false); }
  function toggle() {
    if (open) { close(); return; }
    if (caretRef.current) {
      const r = caretRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setClosing(false);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (caretRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    }
    function onScroll() { close(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 9, width: "100%",
    padding: "8px 10px", borderRadius: 8, background: "none", border: "none",
    color: "var(--agent-text-primary)", fontSize: 13, fontWeight: 500,
    cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <span className={`rem-chase${solo ? " solo" : ""}${disabled ? " is-disabled" : ""}`}>
        <button type="button" className="rem-chase-go" onClick={onChase} disabled={disabled}>
          {label}
        </button>
        {!solo && (
          <button
            ref={caretRef}
            type="button"
            className={`rem-chase-caret${open ? " open" : ""}`}
            onClick={toggle}
            disabled={disabled}
            aria-label="More chase actions"
            aria-expanded={open}
          >
            <CaretDown size={12} weight="bold" />
          </button>
        )}
      </span>

      {!solo && (open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div data-theme={theme} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div
            ref={menuRef}
            className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
            onAnimationEnd={() => { if (closing) setClosing(false); }}
            style={{
              minWidth: 178, padding: 6, borderRadius: 12,
              background: "var(--agent-menu-surface, #ffffff)",
              border: "0.5px solid var(--agent-border-default)",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            }}
          >
            <button className="agent-hover-row" style={itemStyle} onClick={() => { onMarkChased?.(); close(); }}>
              <ArrowClockwise size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
              Mark chased
            </button>
            <button className="agent-hover-row" style={itemStyle} onClick={() => { onMarkDone?.(); close(); }}>
              <CheckCircle size={15} weight="fill" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
              Mark done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
