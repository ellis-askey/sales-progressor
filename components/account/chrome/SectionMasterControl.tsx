"use client";

// components/account/chrome/SectionMasterControl.tsx
//
// The "All on / All off / Custom" control shown in the header of the Email and
// Push notification cards. A preset dropdown (on the canonical Popover) plus a
// master switch. Picking a preset, or flipping the switch, sets every toggle in
// that section at once via onSetAll.

import { CaretDown } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";

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
  const labelColor = allOn ? "var(--agent-success)" : "var(--agent-text-muted)";

  const triggerBtn = (
    <button
      type="button"
      disabled={disabled}
      aria-haspopup="menu"
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
      <CaretDown size={12} weight="bold" />
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        {disabled ? triggerBtn : (
          <Popover preset="menu" placement="bottom-end" width={140} trigger={triggerBtn}>
            {(close) => (
              <>
                <PopoverMenuItem onClick={() => { close(); onSetAll(true); }}>All on</PopoverMenuItem>
                <PopoverMenuItem onClick={() => { close(); onSetAll(false); }}>All off</PopoverMenuItem>
              </>
            )}
          </Popover>
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
        .account-master-drop:hover { background: var(--agent-hover-shade); }
      `}</style>
    </div>
  );
}
