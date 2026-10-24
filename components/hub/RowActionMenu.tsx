"use client";

// Shared Hub row action menu — rides the canonical Popover (portalled to <body>,
// flips/shifts, edge gutter, locked glass) so it never clips inside a card or
// runs off-screen. Used by the "Exchange date passed" row and the
// surveys/valuations rows so every Hub row-action menu looks + behaves
// identically. Any future one gets it free.
//
// Two trigger shapes:
//   - label set        → a standalone "[label] ▾" button.
//   - label omitted +   → a caret-only button meant to sit joined to a preceding
//     joined                main button (split-button look, e.g. "Confirm | ▾").

import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { Popover } from "@/components/ui/Popover";

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
  const joinedStyle: React.CSSProperties = joined
    ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none", padding: "0 7px" }
    : {};

  const triggerBtn = (
    <button
      type="button"
      disabled={disabled}
      aria-label={label ?? ariaLabel}
      className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: label ? 5 : 0, ...joinedStyle }}
    >
      {label}
      <CaretDown size={13} weight="bold" />
    </button>
  );

  // A disabled control must not open — render the trigger bare (the Popover
  // anchor would otherwise still toggle on click).
  if (disabled) return triggerBtn;

  return (
    <Popover preset="menu" placement="bottom-end" width={262} trigger={triggerBtn}>
      {(close) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
              <Link key={item.key} href={item.href} className="agent-hover-row" style={rowStyle} onClick={close}>
                {inner}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                className="agent-hover-row"
                style={rowStyle}
                onClick={() => { item.onClick?.(); close(); }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
