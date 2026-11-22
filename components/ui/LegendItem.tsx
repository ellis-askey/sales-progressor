import type { CSSProperties, ReactNode } from "react";

// Canonical chart / legend key — a rounded tone swatch, an optional emphasised
// value, then a label. One key across donut legends, stacked-bar legends and
// chart keys (previously three near-identical bespoke spans). Compose several in
// a flex row (gap 16) for a full legend.

export function LegendItem({
  color,
  value,
  label,
  style,
}: {
  color: string;
  /** Optional emphasised count shown before the label (tabular). */
  value?: ReactNode;
  label: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--agent-text-secondary)", ...style }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      {value != null && <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</b>}
      {label}
    </span>
  );
}
