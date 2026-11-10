"use client";

// Two-state VAT toggle for a referral fee: "+ VAT" (figure is ex VAT) or
// "inc VAT" (figure includes VAT). Referral income for a VAT-registered agency
// is always VATable, so there is no "no VAT" option. Restyled to the Partners
// rework look — a pair of animated stroke-draw ticks (coral when active),
// matching the add-form fee rows. Props unchanged, so every consumer keeps
// working.

import type { FeeVatTreatment } from "@prisma/client";

const OPTIONS: { key: FeeVatTreatment; label: string }[] = [
  { key: "plus", label: "+ VAT" },
  { key: "inc", label: "inc VAT" },
];

export function VatToggle({
  value,
  onChange,
  disabled,
}: {
  value: FeeVatTreatment;
  onChange: (v: FeeVatTreatment) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="VAT treatment"
      style={{ display: "inline-flex", alignItems: "center", gap: 16, flexShrink: 0, opacity: disabled ? 0.5 : 1 }}
    >
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={disabled}
            aria-pressed={active}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer" }}
          >
            <span className="pf-check" data-checked={active}>
              <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden><path className="pf-tick" d="M5 12.5l4.5 4.5L19 7" /></svg>
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)" }}>{o.label}</span>
          </button>
        );
      })}
      <style>{`
        .pf-check{width:20px;height:20px;border-radius:6px;flex-shrink:0;border:1.5px solid var(--agent-border-strong, rgba(15,23,42,0.25));background:transparent;display:inline-flex;align-items:center;justify-content:center;transition:background 140ms ease,border-color 140ms ease}
        .pf-check[data-checked="true"]{background:var(--agent-coral-deep);border-color:var(--agent-coral-deep)}
        .pf-tick{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:26;stroke-dashoffset:26;transition:stroke-dashoffset 240ms ease 40ms}
        .pf-check[data-checked="true"] .pf-tick{stroke-dashoffset:0}
      `}</style>
    </div>
  );
}
