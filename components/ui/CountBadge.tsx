// components/ui/CountBadge.tsx
//
// Canonical count / number badge for the agent (Sales Progressor) surfaces.
// One outline treatment for every count we show — nav badges, tab counts, the
// notification bell, work-queue section counts, progress ratios. Replaces the
// handful of hand-rolled gradient / tint / red pills that had drifted apart
// (the tab-count pill was copy-pasted verbatim in three files; the bell used a
// literal bg-red-500 outside the danger token).
//
// Style: "outline" — transparent fill, a hairline tone border, tone text. Light
// visual weight, re-themes automatically via the --agent-* accent tokens.
//
// tone     accent  (default / brand)   ·  muted  (autopilot / secondary)   ·  danger (urgent)
// size     md      (default, 18px)      ·  sm     (15px — bell corner, tight rows)
// soft     low-emphasis form — a faded border, for inactive tabs.
//
// Pure presentational: no hooks, renders on server or client.

import type { CSSProperties } from "react";

export type CountTone = "accent" | "muted" | "danger";
export type CountSize = "sm" | "md";

// Strong (default) border per tone.
const BORDER_STRONG: Record<CountTone, string> = {
  accent: "var(--agent-coral-deep)",
  muted: "#64748b",
  danger: "var(--agent-danger)",
};
// Faded border for the `soft` (inactive) form.
const BORDER_SOFT: Record<CountTone, string> = {
  accent: "rgba(var(--agent-coral-base-rgb), 0.5)",
  muted: "rgba(100, 116, 139, 0.5)",
  danger: "rgba(199, 62, 62, 0.5)",
};
const TEXT: Record<CountTone, string> = {
  accent: "var(--agent-coral-deep)",
  muted: "#475569",
  danger: "var(--agent-danger)",
};

const SIZES: Record<CountSize, { minWidth: number; height: number; padding: string; fontSize: number; fontWeight: number; borderWidth: number }> = {
  md: { minWidth: 18, height: 18, padding: "0 6px", fontSize: 11, fontWeight: 700, borderWidth: 1.25 },
  sm: { minWidth: 15, height: 15, padding: "0 4px", fontSize: 9, fontWeight: 800, borderWidth: 1 },
};

export function CountBadge({
  count,
  tone = "accent",
  size = "md",
  soft = false,
  max = 99,
  hideZero = true,
  className,
  style,
  "aria-hidden": ariaHidden,
}: {
  /** The number to show. Strings (e.g. "7/12") render as-is, no capping/zero-hide. */
  count: number | string;
  tone?: CountTone;
  size?: CountSize;
  /** Low-emphasis form — a faded border. Use for inactive tabs. */
  soft?: boolean;
  /** Numeric cap; above it renders `${max}+`. Ignored for string counts. */
  max?: number;
  /** Render nothing when the count is 0 or less (numeric only). Default true. */
  hideZero?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
}) {
  const numeric = typeof count === "number";
  if (numeric && hideZero && count <= 0) return null;
  const label = numeric && count > max ? `${max}+` : count;
  const sz = SIZES[size];

  return (
    <span
      className={className}
      aria-hidden={ariaHidden}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        flexShrink: 0,
        lineHeight: 1,
        whiteSpace: "nowrap",
        borderRadius: 999,
        borderStyle: "solid",
        background: "transparent",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        minWidth: sz.minWidth,
        height: sz.height,
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: sz.fontWeight,
        borderWidth: sz.borderWidth,
        borderColor: soft ? BORDER_SOFT[tone] : BORDER_STRONG[tone],
        color: TEXT[tone],
        ...style,
      }}
    >
      {label}
    </span>
  );
}
