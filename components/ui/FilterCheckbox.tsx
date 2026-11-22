"use client";

import type { ReactNode } from "react";
import { AnimatedTick } from "./AnimatedTick";

// Canonical filter checkbox — the compact filter-rail toggle: a rounded box that
// fills coral and springs on check, with the canonical AnimatedTick drawing its
// stroke in. The whole thing is a hover-row (agent-hover-row). Extracted from the
// Updates filter rail (cf-chk); the bespoke tick SVG is replaced by the canonical
// AnimatedTick so there's one checkmark across the app.
export function FilterCheckbox({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label?: ReactNode;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="agent-hover-row"
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "7px 9px", border: "none", background: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", cursor: disabled ? "default" : "pointer" }}
    >
      <span
        aria-hidden
        style={{
          width: 17, height: 17, borderRadius: 5, flexShrink: 0, display: "grid", placeItems: "center",
          border: `1.5px solid ${checked ? "var(--agent-coral)" : "var(--agent-border-strong)"}`,
          background: checked ? "var(--agent-coral)" : "transparent",
          transform: checked ? "scale(1.06)" : "scale(1)",
          transition: "background-color .18s ease, border-color .18s ease, transform .18s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {checked && <AnimatedTick size={11} color="#fff" strokeWidth={2.6} />}
      </span>
      {label}
    </button>
  );
}
