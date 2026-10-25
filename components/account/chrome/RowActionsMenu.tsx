"use client";

// components/account/chrome/RowActionsMenu.tsx
//
// The "…" overflow menu used on Account list rows (team roster, pending
// invites). Rides the canonical Popover (locked glass, flip/shift, edge gutter,
// neutral Lift hover) so it matches every other agent-app menu. Danger items
// render red.

import { DotsThree } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";

export type RowAction = { label: string; onClick: () => void; danger?: boolean };

export function RowActionsMenu({ items, label = "More actions" }: { items: RowAction[]; label?: string }) {
  if (items.length === 0) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <Popover
        preset="menu"
        placement="bottom-end"
        width={180}
        trigger={
          <button
            type="button"
            aria-haspopup="menu"
            aria-label={label}
            className="account-rowmenu-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              background: "transparent",
              border: "none",
              borderRadius: 7,
              color: "var(--agent-text-muted)",
              cursor: "pointer",
              transition: "background 120ms, color 120ms",
            }}
          >
            <DotsThree size={18} weight="bold" />
          </button>
        }
      >
        {(close) => items.map((it) => (
          <PopoverMenuItem key={it.label} tone={it.danger ? "danger" : "default"} onClick={() => { close(); it.onClick(); }}>
            {it.label}
          </PopoverMenuItem>
        ))}
      </Popover>

      <style>{`
        .account-rowmenu-btn:hover { background: var(--agent-hover-shade); color: var(--agent-text-secondary); }
      `}</style>
    </div>
  );
}
