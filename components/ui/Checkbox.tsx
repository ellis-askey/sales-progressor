"use client";

// Canonical checkbox — an empty rounded box that fills the primary coral and
// draws the canonical AnimatedTick (white) when checked. Extracts the inline
// box-tick already used on the Checkpoints card so consent / referral toggles
// read identically across the app. Keyboard + screen-reader accessible.

import type { ReactNode } from "react";
import { AnimatedTick } from "./AnimatedTick";

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: "none",
          width: 20,
          height: 20,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          background: checked ? "var(--agent-coral-deep)" : "var(--agent-surface-elevated)",
          border: checked ? "none" : "1.5px solid var(--agent-border-strong)",
          transition: "background 160ms ease, border-color 160ms ease",
        }}
      >
        {checked && <AnimatedTick size={13} color="#fff" strokeWidth={3.5} />}
      </span>
      {label != null && (
        <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.3 }}>{label}</span>
      )}
    </button>
  );
}
