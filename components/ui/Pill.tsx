// Canonical Pill primitive. The shape (rounded full, padding, font size,
// optional border) is fixed; consumers supply the tone (colour) and the
// children (label, optional icon, optional arrow glyph).
//
// Phase 2 Week 6 of the discipline migration (see docs/BUILD_PLAN.md).
//
// Decision locked at Phase 0 sign-off: ONE Pill primitive with tones, not
// many. The 4 existing bespoke pill components (DeltaPill, LastContactedPill,
// StatPill, RoundChip) each encode domain-specific business logic
// (arrow direction from delta arithmetic, relative-date band computation,
// link-shaped click target, hover-reveal flip animation). They stay as
// domain-specific composers per Law 14 — Pill is the shape, they compose.
//
// StatusBadge (the existing primitive in components/ui/) keeps its existing
// API but is re-implemented internally using Pill so the visual treatment
// converges. The re-implementation is a follow-up commit per Law 16.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.7 for the catalog
// entry. Gallery at app/dev/gallery/pill/page.tsx.

import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type Tone =
  | "default"   // neutral grey on transparent
  | "muted"     // soft grey-on-grey, low emphasis
  | "brand"     // coral accent (the app's primary)
  | "info"      // blue accent
  | "success"   // green accent
  | "warning"   // amber accent
  | "danger";   // red accent

type Size = "sm" | "md";

// CSS variable mappings per tone. `rgb` is the tone's colour as a raw R,G,B
// channel triple (or a token that resolves to one) — used by the `glass`
// treatment to compose tint / border / shadow at chosen alphas. Background
// uses a low-opacity tint so the pill reads against any agent app surface
// (warm cream, glass, photo).
const toneStyles: Record<Tone, { color: string; background: string; border: string; rgb: string }> = {
  default: {
    color: "var(--agent-text-secondary)",
    background: "rgba(15, 23, 42, 0.05)",
    border: "rgba(15, 23, 42, 0.08)",
    rgb: "100, 116, 139",
  },
  muted: {
    color: "var(--agent-text-muted)",
    background: "transparent",
    border: "rgba(15, 23, 42, 0.12)",
    rgb: "100, 116, 139",
  },
  brand: {
    color: "var(--agent-coral-deep)",
    background: "rgba(var(--agent-coral-rgb), 0.10)",
    border: "rgba(var(--agent-coral-rgb), 0.30)",
    rgb: "var(--agent-coral-rgb)",
  },
  info: {
    color: "var(--agent-info)",
    background: "var(--agent-info-bg)",
    border: "var(--agent-info-border-strong)",
    rgb: "var(--agent-info-rgb)",
  },
  success: {
    color: "var(--agent-success)",
    background: "var(--agent-success-bg)",
    border: "var(--agent-success-border-strong)",
    rgb: "var(--agent-success-rgb)",
  },
  warning: {
    color: "var(--agent-warning)",
    background: "var(--agent-warning-bg)",
    border: "var(--agent-warning-border-strong)",
    rgb: "var(--agent-warning-rgb)",
  },
  danger: {
    color: "var(--agent-danger)",
    background: "var(--agent-danger-bg)",
    border: "var(--agent-danger-border-strong)",
    rgb: "var(--agent-danger-rgb)",
  },
};

const sizeStyles: Record<Size, { padding: string; fontSize: number; gap: number }> = {
  sm: { padding: "1px 7px",  fontSize: 10, gap: 4 },
  md: { padding: "3px 10px", fontSize: 11, gap: 5 },
};

export type PillProps = Omit<HTMLAttributes<HTMLSpanElement>, "color"> & {
  tone?: Tone;
  size?: Size;
  // When true, renders a 1px border instead of a tint background.
  // Useful for the "no data yet" / "empty" pill shape.
  outline?: boolean;
  // Curated glass treatment: a top sheen, an inner light edge and a soft
  // tone-tinted shadow, so the pill reads like a tiny glass card matching
  // the app's surfaces. Theme-aware via .agent-pill-glass in agent-system.css.
  glass?: boolean;
  // Small leading dot in the tone colour. Pairs with `glass` for the milestone
  // signal chips. Omit when the pill already leads with an icon.
  dot?: boolean;
  children?: ReactNode;
};

export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  {
    tone = "default",
    size = "md",
    outline = false,
    glass = false,
    dot = false,
    className = "",
    style,
    children,
    ...rest
  },
  ref,
) {
  const t = toneStyles[tone];
  const s = sizeStyles[size];

  const composed: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: s.gap,
    padding: s.padding,
    borderRadius: 999,
    fontSize: s.fontSize,
    fontWeight: 600,
    lineHeight: 1.4,
    color: t.color,
    whiteSpace: "nowrap",
    ...(glass
      ? {
          backgroundColor: `rgba(${t.rgb}, 0.14)`,
          border: `0.5px solid rgba(${t.rgb}, 0.34)`,
        }
      : {
          background: outline ? "transparent" : t.background,
          border: outline ? `1px solid ${t.border}` : "0.5px solid transparent",
        }),
    ...style,
  };
  if (glass) {
    // The .agent-pill-glass shadow tints itself from this channel triple.
    (composed as Record<string, string>)["--pill-rgb"] = t.rgb;
  }

  return (
    <span
      ref={ref}
      className={`${glass ? "agent-pill-glass " : ""}${className}`.trim()}
      style={composed}
      {...rest}
    >
      {dot && <span className="pill-dot" style={{ width: 5, height: 5, borderRadius: 999, background: t.color, flexShrink: 0 }} />}
      {children}
    </span>
  );
});
