"use client";

// components/account/chrome/RowActionsMenu.tsx
//
// The "…" overflow menu used on Account list rows (team roster, pending
// invites). A dots button that opens a small right-aligned popup of actions;
// each action closes the menu and runs its handler. Click-outside + Escape
// dismiss. Danger items render red.

import { useEffect, useRef, useState } from "react";
import { DotsThree } from "@phosphor-icons/react";

export type RowAction = { label: string; onClick: () => void; danger?: boolean };

export function RowActionsMenu({ items, label = "More actions" }: { items: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="account-rowmenu-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          background: open ? "rgba(0,0,0,0.05)" : "transparent",
          border: "none",
          borderRadius: 7,
          color: "#6b7280",
          cursor: "pointer",
          transition: "background 120ms, color 120ms",
        }}
      >
        <DotsThree size={18} weight="bold" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: 172,
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.10)",
            borderRadius: 11,
            boxShadow: "0 12px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: 6,
            zIndex: 30,
            animation: "account-rowmenu-in 130ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`account-rowmenu-item${it.danger ? " account-rowmenu-item-danger" : ""}`}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                background: "none",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: it.danger ? "#b91c1c" : "#111827",
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .account-rowmenu-btn:hover { background: rgba(0,0,0,0.05); color: #374151; }
        .account-rowmenu-item:hover { background: rgba(0,0,0,0.05); }
        .account-rowmenu-item-danger:hover { background: #fef2f2; }
        @keyframes account-rowmenu-in {
          from { opacity: 0; transform: translateY(-3px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
