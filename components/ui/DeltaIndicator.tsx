import type { CSSProperties } from "react";

// Canonical delta / trend indicator — an ↑/↓ glyph + percent in success/danger,
// with a muted suffix ("vs prev"). `goodWhenUp` flips which direction reads as
// good (down is good for e.g. bounce rate). Zero renders a muted "No change"
// line. Extracted from the automated-emails activity panel's DeltaChip. The
// StatPill/DeltaPill domain composers (link-shaped, hover-flip) stay separate.

export function DeltaIndicator({
  pct,
  goodWhenUp = true,
  suffix = "vs prev",
  style,
}: {
  /** Signed percentage change. 0 → "No change". */
  pct: number;
  goodWhenUp?: boolean;
  suffix?: string;
  style?: CSSProperties;
}) {
  if (pct === 0) {
    return <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", ...style }}>No change {suffix}</p>;
  }
  const up = pct > 0;
  const good = up === goodWhenUp;
  return (
    <p style={{ margin: "2px 0 0", fontSize: 11, color: good ? "var(--agent-success)" : "var(--agent-danger)", display: "flex", alignItems: "center", gap: 3, ...style }}>
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(pct)}%
      <span style={{ color: "var(--agent-text-muted)" }}>{suffix}</span>
    </p>
  );
}
