import type { CSSProperties } from "react";

// Canonical horizontal stacked proportion bar — a rounded track split into tone
// segments by percentage, on a nested-surface track. Pair with LegendItem for
// the key. Extracted from the automated-emails chase-performance / email-health
// breakdowns. Differs from HeatBand (equal cells encoding one value each) — this
// shows the proportions of a single whole.

export function StackedBar({
  segments,
  height = 12,
  gap = 0,
  style,
}: {
  segments: { pct: number; color: string; dim?: boolean }[];
  height?: number;
  /** Hairline gap between segments (px). */
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", background: "var(--agent-surface-nested, rgba(15,23,42,0.05))", ...style }}>
      {segments.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${s.pct}%`,
            background: s.color,
            opacity: s.dim ? 0.7 : 1,
            marginLeft: gap && i > 0 ? gap : undefined,
          }}
        />
      ))}
    </div>
  );
}
