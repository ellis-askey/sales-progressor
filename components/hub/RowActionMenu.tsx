"use client";

// Shared Hub row action menu — a floating dropdown (portalled to <body> and
// clamped to the viewport, so it never clips inside a card or runs off-screen).
// Used by the "Exchange date passed" row and the surveys/valuations rows so every
// Hub row-action menu looks + behaves identically. Any future one gets it free.
//
// Two trigger shapes:
//   - label set        → a standalone "[label] ▾" button.
//   - label omitted +   → a caret-only button meant to sit joined to a preceding
//     joined                main button (split-button look, e.g. "Confirm | ▾").

import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";

const MENU_W = 262;

export type RowMenuItem = {
  key: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  danger?: boolean;
  href?: string;        // renders a Link (navigates)
  onClick?: () => void; // renders a button (runs the action)
  disabled?: boolean;
};

export function RowActionMenu({
  items,
  label,
  joined,
  disabled,
  ariaLabel = "More options",
}: {
  items: RowMenuItem[];
  label?: string;
  joined?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    const estH = 40 + items.length * 52;
    const top = r.bottom + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH - 4) : r.bottom + 4;
    setPos({ top, left });
  }, [open, items.length]);

  const joinedStyle: React.CSSProperties = joined
    ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none", padding: "0 7px" }
    : {};

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={label ?? ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: label ? 5 : 0, ...joinedStyle }}
      >
        {label}
        <CaretDown size={13} weight="bold" style={{ transition: "transform 160ms", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && pos && typeof window !== "undefined" && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1400 }} />
          <div
            role="menu"
            style={{
              position: "fixed", top: pos.top, left: pos.left, width: MENU_W, zIndex: 1401,
              background: "var(--agent-menu-surface, #ffffff)",
              border: "0.5px solid var(--agent-border-default)",
              borderRadius: 12, boxShadow: "0 12px 32px rgba(15,23,42,0.16)", padding: 6,
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            {items.map((item) => {
              const inner = (
                <>
                  <span aria-hidden style={{ color: item.danger ? "#b91c1c" : "var(--agent-coral-deep)", marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: item.danger ? "#b91c1c" : "var(--agent-text-primary)" }}>{item.title}</span>
                    {item.sub && <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.35, marginTop: 1 }}>{item.sub}</span>}
                  </span>
                </>
              );
              const rowStyle: React.CSSProperties = {
                display: "flex", gap: 9, alignItems: "flex-start", width: "100%", textAlign: "left",
                padding: "8px 10px", borderRadius: 8, background: "none", border: "none",
                cursor: item.disabled ? "default" : "pointer", textDecoration: "none",
              };
              return item.href ? (
                <Link key={item.key} href={item.href} className="agent-hover-row" style={rowStyle} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  className="agent-hover-row"
                  style={rowStyle}
                  onClick={() => { item.onClick?.(); setOpen(false); }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
