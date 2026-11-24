"use client";

// Canonical number stepper — a compact [−] value [+] control for small bounded
// integers (chase-cadence days, escalation counts, quantities). Clamps to
// [min, max], disables the key at each bound, and selects-all on focus so a
// typed value overwrites cleanly. Token-based (light + dark); the active key
// uses a flat coral (not a gradient), matching the canonical button.
//
// Extracted from the Automated-chasing cadence editor (2026-11-24) and promoted
// to a shared primitive. `size="lg"` is the roomier variant used for a single
// prominent value (e.g. the global "hand back after N" control).

import { useEffect } from "react";

let injected = false;
function useStepperCss() {
  useEffect(() => {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("ui-stepper-css")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "ui-stepper-css";
    el.textContent = STEPPER_CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  size = "md",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  size?: "md" | "lg";
  ariaLabel?: string;
}) {
  useStepperCss();
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <span className={`ui-stepper${size === "lg" ? " ui-stepper-lg" : ""}`} role="group" aria-label={ariaLabel}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(clamp(n)); }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
    </span>
  );
}

const STEPPER_CSS = `
.ui-stepper{display:inline-flex;align-items:center;background:var(--agent-surface-elevated,#fff);border:1.5px solid var(--agent-border-default);border-radius:11px;overflow:hidden;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:border-color .15s;vertical-align:middle}
.ui-stepper:focus-within{border-color:var(--agent-coral-deep)}
.ui-stepper button{appearance:none;border:none;cursor:pointer;width:32px;height:36px;display:grid;place-items:center;font-size:18px;font-weight:600;line-height:1;transition:background .14s,color .14s,transform .1s;color:var(--agent-text-muted);background:transparent}
.ui-stepper button:hover:not(:disabled){color:var(--agent-text-on-coral,#fff);background:var(--agent-coral-deep)}
.ui-stepper button:active:not(:disabled){transform:scale(.9);background:var(--agent-coral-darker,#C0431F);color:var(--agent-text-on-coral,#fff)}
.ui-stepper button:disabled{opacity:.4;cursor:not-allowed}
.ui-stepper input{width:38px;height:36px;border:none;background:none;text-align:center;font:inherit;font-size:15.5px;font-weight:700;color:var(--agent-text-primary);padding:0}
.ui-stepper input:focus{outline:none}
.ui-stepper-lg input{width:44px;font-size:17px}
`;

export default NumberStepper;
