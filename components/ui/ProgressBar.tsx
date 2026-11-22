import type { CSSProperties } from "react";

// Canonical linear progress bar — a thin rounded track with a coral fill. The
// linear sibling of ProgressRing, for inline file-progress (the Updates file
// snapshot, etc.). Pass a 0–100 percent.
export function ProgressBar({
  percent,
  width,
  height = 4,
  color = "var(--agent-coral)",
  track = "var(--agent-hero-track, rgba(15,23,42,0.08))",
  style,
}: {
  percent: number;
  /** Fixed width in px; omit to fill the container. */
  width?: number;
  height?: number;
  color?: string;
  track?: string;
  style?: CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ width: width ?? "100%", height, borderRadius: 999, background: track, overflow: "hidden", ...style }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 400ms cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}
