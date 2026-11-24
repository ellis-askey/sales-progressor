"use client";

// Canonical price field — the arc MoneyInput locked to GBP (£, no currency menu,
// no quick-add chips), sized for a form field, with the border on the agent token.
// Value is in PENCE (minor units), matching our purchasePricePence storage, so it
// is a drop-in for PriceInput. Arc tokens are mapped to the agent look here so the
// field reads native in the app.

import type { CSSProperties } from "react";
import MoneyInput from "@/components/arc/money-input/money-input";
import "@/components/arc/cookie-consent/scope.css";

// Everything the MoneyInput CSS reads, mapped to the agent look. Kept here (not
// relying on scope.css) so the field renders correctly wherever it is dropped.
const TOKENS: CSSProperties = {
  ["--font-body" as string]: "inherit",
  ["--font-display" as string]: "inherit",
  ["--tracking-body" as string]: "0em",
  ["--tracking-display" as string]: "var(--agent-tracking-tight, -0.01em)",
  ["--leading-body" as string]: "1.5",
  ["--space-2" as string]: "8px",
  ["--space-3" as string]: "12px",
  ["--text-sm" as string]: "13px",
  ["--text-xs" as string]: "12px",
  ["--text-2xl" as string]: "20px",
  ["--radius-panel" as string]: "12px",
  ["--radius-pill" as string]: "999px",
  ["--surface" as string]: "var(--agent-surface-elevated, #ffffff)",
  ["--surface-muted" as string]: "var(--agent-surface-muted, rgba(45,24,16,0.05))",
  ["--border-strong" as string]: "var(--agent-border-default, rgba(45,24,16,0.14))",
  ["--foreground" as string]: "var(--agent-text-primary, #2D1810)",
  ["--text-secondary" as string]: "var(--agent-text-secondary, rgba(45,24,16,0.60))",
  ["--text-muted" as string]: "var(--agent-text-muted, rgba(45,24,16,0.55))",
  ["--danger" as string]: "#C73E3E",
  ["--warning" as string]: "var(--agent-warning, #C97D1A)",
  ["--duration-fast" as string]: "150ms",
  ["--duration-standard" as string]: "200ms",
  ["--duration-instant" as string]: "100ms",
  ["--duration-spring" as string]: "320ms",
  ["--ease-standard" as string]: "cubic-bezier(0.22,1,0.36,1)",
  ["--ease-spring" as string]: "cubic-bezier(0.22,1,0.36,1)",
};

export function PriceField({
  value,
  onChange,
  label = "Amount",
  hideLabel = false,
  /** Shell height + amount size. Default sized for a form field (not the 76px hero default). */
  height = 54,
  fontSize = 24,
  /** Borderless + transparent + no padding — for an inline £ amount inside an
   *  already-bordered container (e.g. the commission box beside the VAT toggle). */
  bare = false,
  /** Coral (brand) border — subtle coral at rest, coral-deep on hover/focus. The
   *  prominent price field (sale price) uses this; a neutral field doesn't. */
  accent = false,
  disabled = false,
  error,
  name,
  className,
}: {
  value: number | null;
  onChange: (pence: number | null) => void;
  label?: string;
  hideLabel?: boolean;
  height?: number;
  fontSize?: number;
  bare?: boolean;
  accent?: boolean;
  disabled?: boolean;
  error?: string;
  name?: string;
  className?: string;
}) {
  const bareTokens: CSSProperties = bare
    ? {
        ["--surface" as string]: "transparent",
        ["--border-strong" as string]: "transparent",
        ["--money-input-pad" as string]: "0",
        ["--money-input-border-hover" as string]: "transparent",
        ["--money-input-border-focus" as string]: "transparent",
      }
    : accent
    ? {
        ["--border-strong" as string]: "rgba(255,107,74,0.32)",
        ["--money-input-border-hover" as string]: "var(--agent-coral-deep, #FF6B4A)",
        ["--money-input-border-focus" as string]: "var(--agent-coral-deep, #FF6B4A)",
      }
    : {};
  return (
    <div
      className="arc-scope"
      style={{ ...TOKENS, ...bareTokens, ["--money-input-height" as string]: `${height}px`, ["--text-3xl" as string]: `${fontSize}px` }}
    >
      <MoneyInput
        label={label}
        hideLabel={hideLabel}
        value={value}
        onValueChange={(pence) => onChange(pence)}
        currencies={["GBP"]}
        defaultCurrency="GBP"
        locale="en-GB"
        showCurrency={false}
        quickAdd={[]}
        disabled={disabled}
        error={error}
        name={name}
        className={className}
      />
    </div>
  );
}
