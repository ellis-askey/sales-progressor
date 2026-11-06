"use client";

// Shared chart/map hover-tooltip that renders through a portal on document.body.
//
// Why this exists: a frosted-glass tooltip (backdrop-filter) only frosts the
// page when nothing in its ancestor chain establishes a backdrop root. The hub
// charts, the Files forecast and the chain map all live INSIDE GlassCards, which
// are themselves backdrop-filtered — so an inline tooltip's blur samples the
// card's flat surface, not the page, and reads see-through no matter how its
// recipe is tuned. The canonical menus (components/ui/Popover.tsx) and the
// pipeline-stage bubble (PipelineStageHover) look right precisely because they
// portal out to <body>. This gives the chart/map tooltips the same escape hatch.
//
// Portals sit on <body>, OUTSIDE .agent-shell-root, so --agent-* custom
// properties don't inherit. Rather than hardcode a token set (which would break
// per-agency brand colour + light/dark), we mirror the live computed values off
// the shell onto the bubble, re-reading when the theme flips. The caller keeps
// its existing surface class (.ui-chart-tip / .fc-tip / .chn-tip) and content;
// only where the bubble lives in the DOM changes.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

// Every --agent-* token the chart/map tooltip bodies read. Mirrored off the
// shell so the portalled bubble resolves them exactly as it would inline.
const MIRROR_TOKENS = [
  "--agent-surface-elevated",
  "--agent-glass-border",
  "--agent-border-default",
  "--agent-border-subtle",
  "--agent-text-primary",
  "--agent-text-secondary",
  "--agent-text-muted",
  "--agent-coral",
  "--agent-coral-deep",
  "--agent-coral-rgb",
  "--agent-success",
  "--agent-warning",
  "--agent-warning-rgb",
] as const;

function readShellTokens(): CSSProperties {
  if (typeof document === "undefined") return {};
  const shell = document.querySelector(".agent-shell-root");
  if (!shell) return {};
  const cs = getComputedStyle(shell);
  const out: Record<string, string> = {};
  for (const name of MIRROR_TOKENS) {
    const v = cs.getPropertyValue(name).trim();
    if (v) out[name] = v;
  }
  return out as CSSProperties;
}

const GAP = 10;

export function ChartTipPortal({
  x,
  y,
  place = "above",
  className = "ui-chart-tip",
  maxWidth = 260,
  role = "tooltip",
  style,
  children,
}: {
  /** Viewport X the tooltip points at (its horizontal centre). */
  x: number;
  /** Viewport Y the tooltip points at (its anchor edge). */
  y: number;
  /** Above the point (default) or below it. */
  place?: "above" | "below";
  /** Surface class to keep the caller's look + any child-element styling. */
  className?: string;
  maxWidth?: number;
  role?: "tooltip" | "status";
  /** Per-call layout (padding/font) the original inline tooltip carried. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [tokens, setTokens] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    const sync = () => setTokens(readShellTokens());
    sync();
    const root = document.documentElement;
    const shell = document.querySelector(".agent-shell-root");
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    if (shell) obs.observe(shell, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Measure the bubble so it can be placed with top/left and NO transform. A
  // persistent `transform` on a backdrop-filter element kills the blur (the
  // element gets its own composite layer and samples an empty backdrop, so it
  // reads see-through). The canonical Popover avoids this by positioning via
  // top/left after measuring — this does the same. Re-measures when the anchor
  // moves; the equality guard stops it looping on re-renders.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setSize((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
  }, [mounted, x, y, maxWidth]);

  if (!mounted) return null;

  const vw = window.innerWidth;
  const above = place === "above";
  const w = size?.w ?? 0;
  const h = size?.h ?? 0;
  // Centre horizontally on the anchor via computed left (no transform), clamped
  // to an 8px viewport gutter. Vertically, sit the measured height above the
  // anchor, or drop below it.
  const left = Math.max(8, Math.min(vw - w - 8, x - w / 2));
  const top = above ? y - GAP - h : y + GAP;

  const pos: CSSProperties = {
    position: "fixed",
    left,
    top,
    // Explicitly none: the .fc-tip / .chn-tip surface classes set their own
    // transform, which would re-break the backdrop-filter blur if it applied.
    transform: "none",
    maxWidth,
    width: "max-content",
    zIndex: 300,
    pointerEvents: "none",
    // Hidden for the first (pre-measure) paint so it never flashes at the wrong
    // spot; shown once measured.
    visibility: size ? "visible" : "hidden",
    animation: "enter-fade 140ms cubic-bezier(0.4,0,0.2,1)",
  };

  return createPortal(
    <div ref={ref} className={className} role={role} style={{ ...tokens, ...pos, ...style }}>
      {children}
    </div>,
    document.body,
  );
}
