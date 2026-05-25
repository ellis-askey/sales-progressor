// components/billing/polish/StateToggle.tsx
//
// Pill row at the top of /agent/polish/billing-hub. Each pill is a Link
// that swaps the ?state= searchParam — the page server-component then
// re-resolves and renders against a different seeded agency's real data.
//
// Uses .agent-segment-pill (canonical interactive class — see
// ANIMATION_STANDARDS / agent-system.css).

import Link from "next/link";

export const POLISH_STATES = [
  { key: "populated",    label: "Populated",    agency: "Hartwell & Partners" },
  { key: "empty",        label: "Empty month",  agency: "Marlow & Co"          },
  { key: "brand-new",    label: "Brand-new",    agency: "Tidy & Co"            },
  { key: "vat-off",      label: "VAT off",      agency: "Marlow & Co"          },
  { key: "payment-failed", label: "Payment failed", agency: "Beacon Estates"    },
] as const;

export type PolishStateKey = typeof POLISH_STATES[number]["key"];

export function StateToggle({ activeKey }: { activeKey: PolishStateKey }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "10px 14px",
        background: "var(--agent-readonly-bg, rgba(0,0,0,0.025))",
        border: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
        borderRadius: 10,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600, marginRight: 4 }}>
        State:
      </span>
      {POLISH_STATES.map((s) => (
        <Link
          key={s.key}
          href={`?state=${s.key}`}
          className={`agent-segment-pill agent-segment-pill-sm${s.key === activeKey ? " on" : ""}`}
          style={{ textDecoration: "none" }}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
