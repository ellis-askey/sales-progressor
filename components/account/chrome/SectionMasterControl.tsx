"use client";

// components/account/chrome/SectionMasterControl.tsx
//
// The "All on / All off / Custom" control shown in the header of the Email and
// Push notification cards. A preset dropdown (on the canonical Popover) plus a
// master switch. Picking a preset, or flipping the switch, sets every toggle in
// that section at once via onSetAll.

import { CaretDown } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

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

      <LiquidToggle
        checked={allOn}
        onChange={(next) => onSetAll(next)}
        width={44}
        height={24}
        color="var(--agent-coral, #FF8A65)"
        disabled={disabled}
        aria-label={allOn ? "Turn all off" : "Turn all on"}
      />

      <style>{`
        .account-master-drop:hover { background: var(--agent-hover-shade); }
      `}</style>
    </div>
  );
}
