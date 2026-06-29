// Canonical Skeleton primitive. A placeholder shape that mimics the size
// of the content it stands in for, with a subtle pulse animation. Used
// for loading states across cards, lists, and pages.
//
// Phase 2 Week 8-9 of the discipline migration.
//
// Variants:
//   - line   — single-line text placeholder (a row of pulsing rectangle)
//   - block  — multi-line text or a rectangular content area
//   - circle — circular placeholder (avatar, role icon, status badge)
//   - card   — full card-shaped surface (header + body lines pre-composed)
//
// 4 files use `animate-pulse` raw today. Migration is mechanical per
// consumer (Law 16). PanelSkeletons.tsx and SpLoadingShell.tsx are bespoke
// consumers that stay as domain-specific composers (they encode panel-grid
// layout knowledge that isn't a primitive concern) — they'll wrap Skeleton
// for the individual rows.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.11 for the catalog
// entry. Gallery story at app/dev/gallery/skeleton/page.tsx.

import type { HTMLAttributes } from "react";

type Variant = "line" | "block" | "circle" | "card";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  // Width override. Strings map to CSS width values (e.g. "60%", "200px").
  // Numbers are treated as pixel widths.
  width?: number | string;
  // Height override. Only applies to variant="block" — line/circle/card
  // ignore this (their heights are spec-locked).
  height?: number | string;
};

const baseStyle = (animated: boolean): React.CSSProperties => ({
  background: "linear-gradient(90deg, rgba(15,23,42,0.06) 0%, rgba(15,23,42,0.12) 50%, rgba(15,23,42,0.06) 100%)",
  backgroundSize: "200% 100%",
  animation: animated ? "agent-shimmer 1.6s ease-in-out infinite" : undefined,
  display: "inline-block",
});

export function Skeleton({
  variant = "line",
  width,
  height,
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  // Respect prefers-reduced-motion at the OS level via CSS — the
  // animation keyframe is `agent-shimmer` which is set up to honour
  // reduced motion (see agent-system.css). No JS check needed.

  let composed: React.CSSProperties = { ...baseStyle(true), ...style };

  switch (variant) {
    case "line": {
      composed = {
        ...composed,
        width: width ?? "100%",
        height: 12,
        borderRadius: 6,
      };
      break;
    }
    case "block": {
      composed = {
        ...composed,
        width: width ?? "100%",
        height: height ?? 80,
        borderRadius: 8,
      };
      break;
    }
    case "circle": {
      const size = width ?? 32;
      composed = {
        ...composed,
        width: size,
        height: size,
        borderRadius: "50%",
      };
      break;
    }
    case "card": {
      // The card variant is a compound shape — header line + body lines.
      // Rather than expose more sub-component machinery, we render the
      // composition inline. Consumers who need finer control can compose
      // their own from Skeleton variant="line" + variant="block".
      composed = {
        ...composed,
        // The outer Skeleton card has no pulse itself; the children pulse.
        animation: undefined,
        background: "transparent",
        display: "block",
        width: width ?? "100%",
        padding: 16,
      };
      return (
        <div
          className={`glass-card rounded-[12px] ${className}`.trim()}
          style={composed}
          aria-hidden="true"
          {...rest}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Skeleton variant="circle" width={32} />
            <Skeleton variant="line" width="40%" />
          </div>
          <Skeleton variant="line" width="80%" style={{ marginBottom: 8 }} />
          <Skeleton variant="line" width="60%" />
        </div>
      );
    }
  }

  return (
    <div
      className={className}
      style={composed}
      aria-hidden="true"
      {...rest}
    />
  );
}
