"use client";

// Canonical percent field — the % sibling of PriceField. Same shell + sizing as the
// bare PriceField so a "Fixed £ / Percent %" toggle swaps between two identical-looking
// fields. Reuses the already light/dark-correct `.price-hero-input-native` input and adds
// a "%" suffix. Value is the raw string (e.g. "2.5") to preserve mid-type states like
// "2." — matching the live agentFeePercentStr field it replaces.

import type { CSSProperties } from "react";

export function PercentField({
  value,
  onChange,
  label = "Percentage",
  hideLabel = false,
  /** Shell height when not bare. Matches PriceField's form-field default. */
  height = 54,
  fontSize = 24,
  /** Borderless + transparent — for an inline % inside an already-bordered box
   *  (e.g. the commission box beside the VAT toggle). Mirrors PriceField `bare`. */
  bare = false,
  /** Coral (brand) border — subtle coral at rest. Mirrors PriceField `accent`. */
  accent = false,
  disabled = false,
  min = 0,
  max = 100,
  step = 0.01,
  placeholder = "0",
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hideLabel?: boolean;
  height?: number;
  fontSize?: number;
  bare?: boolean;
  accent?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  name?: string;
  className?: string;
}) {
  const shell: CSSProperties = bare
    ? { display: "flex", alignItems: "center", gap: 6 }
    : {
        display: "flex",
        alignItems: "center",
        gap: 6,
        height,
        padding: "0 14px",
        borderRadius: 12,
        border: `1px solid ${accent ? "rgba(255,107,74,0.32)" : "var(--agent-border-default)"}`,
        background: "var(--agent-surface-elevated)",
        opacity: disabled ? 0.55 : 1,
      };

  return (
    <div className={className} style={{ width: "100%" }}>
      {!hideLabel && label && (
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={shell}>
        <input
          type="number"
          className="price-hero-input-native"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          name={name}
          aria-label={hideLabel ? label : undefined}
          style={{ fontSize }}
        />
        <span style={{ fontSize, fontWeight: 600, color: "var(--agent-text-faint, rgba(45,24,16,0.32))", flexShrink: 0 }}>%</span>
      </div>
    </div>
  );
}
