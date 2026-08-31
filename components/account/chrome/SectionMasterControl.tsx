"use client";

// components/account/chrome/SectionMasterControl.tsx
//
// The "All on / All off / Custom" control shown in the header of the Email and
// Push notification cards. A preset dropdown (label reflects the aggregate of
// the section's toggles) plus a master switch. Picking a preset, or flipping
// the switch, sets every toggle in that section at once via onSetAll.

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export function SectionMasterControl({
  values,
  onSetAll,
  disabled,
}: {
  values: boolean[];
  onSetAll: (value: boolean) => void;
  disabled?: boolean;
}) {
  const allOn = values.length > 0 && values.every(Boolean);
  const allOff = values.every((v) => !v);
  const label = allOn ? "All on" : allOff ? "All off" : "Custom";
  const labelColor = allOn ? "#16a34a" : "#6b7280";

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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          className="account-master-drop"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 8px",
            fontSize: 13,
            fontWeight: 600,
            color: labelColor,
            background: "transparent",
            border: "none",
            borderRadius: 7,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          {label}
          <CaretDown size={12} weight="bold" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
        {open && (
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              minWidth: 130,
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.10)",
              borderRadius: 10,
              boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
              padding: 6,
              zIndex: 30,
              animation: "account-rowmenu-in 130ms cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            {[
              { label: "All on", value: true },
              { label: "All off", value: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSetAll(opt.value);
                }}
                className="account-rowmenu-item"
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
                  color: "#111827",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={allOn}
        aria-label={allOn ? "Turn all off" : "Turn all on"}
        disabled={disabled}
        onClick={() => onSetAll(!allOn)}
        style={{
          position: "relative",
          display: "inline-flex",
          width: 44,
          height: 24,
          flexShrink: 0,
          borderRadius: 999,
          background: allOn ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          padding: 0,
          transition: "background 150ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: allOn ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            transition: "left 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </button>

      <style>{`
        .account-master-drop:hover { background: rgba(0,0,0,0.04); }
        .account-rowmenu-item:hover { background: rgba(0,0,0,0.05); }
      `}</style>
    </div>
  );
}
