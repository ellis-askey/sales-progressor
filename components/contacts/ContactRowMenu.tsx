"use client";

// Kebab overflow menu for a contact row on /agent/transactions/[id]. Holds
// the Edit / Remove actions that were previously inline text-links — moved
// here to free horizontal space for the new LastContactedPill on the
// secondary line.
//
// Pattern mirrors components/transaction/StatusControl.tsx: portal-rendered
// dropdown anchored to the trigger button, dismissed on outside click +
// Escape. Reuses canonical .agent-dropdown-in / .agent-dropdown-item from
// app/agent/styles/agent-system.css.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVertical } from "@phosphor-icons/react";

type Props = {
  contactName: string;
  onEdit: () => void;
  onRemove: () => void;
};

export function ContactRowMenu({ contactName, onEdit, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // Position the menu below + right-aligned to the trigger so it sits
    // inside the row's gutter rather than spilling over content.
    const MENU_WIDTH = 140;
    setPos({
      top: r.bottom + 4,
      left: Math.max(8, r.right - MENU_WIDTH),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={`Actions for ${contactName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="agent-icon-btn agent-icon-btn-sm"
        style={{ flexShrink: 0 }}
      >
        <DotsThreeVertical size={14} weight="bold" />
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop — click anywhere off the menu to close */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 1499 }}
              aria-hidden
            />
            {/* Menu — sizes hardcoded inline because the menu portals out
                to document.body, where any CSS-variable inheritance scoped
                to the agent shell (e.g. --agent-text-micro) doesn't apply. */}
            <div
              role="menu"
              className="agent-dropdown-in"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 1500,
                minWidth: 132,
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "0.5px solid rgba(15,23,42,0.10)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(15,23,42,0.14)",
                padding: 3,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(15,23,42,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 9px",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: "#111827",
                  background: "transparent",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRemove();
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 9px",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: "var(--agent-danger, #dc2626)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Remove
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
