"use client";

// Canonical Select — the agent-app single-choice picker. It is NOT a new dropdown:
// it reuses the canonical AnchoredPanel + .ui-pop-pick menu (already light/dark-correct)
// and only standardises the TRIGGER (a LabelInput-weight box + a real CaretDown) and the
// results / add-new rows. Replaces the three bespoke selects in the Add-Sale flow
// (case handler, progressor, etc.). The menu itself is unchanged by design.
//
// Sizing matches the approved prototype (48px trigger, 20px radius) — a form-field select.
// Pass `addAction` to append the canonical "+ Add…" row at the foot of the menu.

import { useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnchoredPanel } from "@/components/ui/Popover";
import { CaretDown, Check } from "@phosphor-icons/react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  addAction,
  accent = false,
  disabled = false,
  fullWidth = true,
  /** Trigger height. Default 48 (form-field default, matches LabelInput md). Pass 40
   *  to sit level with a native `agent-input` select without enlarging it. */
  height = 48,
  /** Trigger corner radius. Default 20; pass 8 (radius-md) to match agent-input. */
  radius = 20,
  id,
  className,
}: {
  label?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Appends the canonical "+ {label}" row to the foot of the menu. */
  addAction?: { label: string; onClick: () => void };
  /** Coral (brand) border at rest, coral-deep when open — for a prominent select. */
  accent?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  height?: number;
  radius?: number;
  id?: string;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const controlId = useId();
  const current = options.find((o) => o.value === value) ?? null;

  const restBorder = accent ? "rgba(255,107,74,0.32)" : "var(--agent-border-default)";
  const triggerStyle: CSSProperties = {
    width: fullWidth ? "100%" : undefined,
    height,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 15,
    borderRadius: radius,
    border: `1px solid ${open || accent ? "var(--agent-coral-deep, #FF6B4A)" : restBorder}`,
    background: "var(--agent-surface-elevated)",
    color: current ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "border-color 150ms",
  };

  return (
    <div style={{ width: fullWidth ? "100%" : undefined }} className={className}>
      {label && (
        <label
          htmlFor={id ?? controlId}
          style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}
        >
          {label}
        </label>
      )}
      <button
        ref={ref}
        id={id ?? controlId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={triggerStyle}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.label ?? placeholder}
        </span>
        <CaretDown
          size={15}
          color="var(--agent-text-muted)"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>
      <AnchoredPanel anchorRef={ref} open={open} onClose={() => setOpen(false)} matchWidth bare placement="bottom-start" role="listbox">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={o.disabled}
              className="ui-pop-pick"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              onMouseDown={() => {
                if (o.disabled) return;
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {selected && <Check size={15} weight="bold" color="var(--agent-coral-deep, #FF6B4A)" style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
        {addAction && (
          <button
            type="button"
            className="ui-pop-pick ui-pop-pick-add"
            onMouseDown={() => {
              addAction.onClick();
              setOpen(false);
            }}
          >
            + {addAction.label}
          </button>
        )}
      </AnchoredPanel>
    </div>
  );
}
