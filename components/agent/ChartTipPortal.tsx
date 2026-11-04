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

import { useEffect, useState } from "react";
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

  if (!mounted) return null;

  const vw = window.innerWidth;
  const half = maxWidth / 2;
  // Centre on the anchor via translateX(-50%) so it's exact whatever the content
  // width is; clamp the centre by half the max width so a full-width bubble can't
  // spill past the viewport edge.
  const cx = Math.max(half + 8, Math.min(vw - half - 8, x));
  const above = place === "above";

  const pos: CSSProperties = {
    position: "fixed",
    left: cx,
    top: above ? y - GAP : y + GAP,
    transform: above ? "translate(-50%, -100%)" : "translateX(-50%)",
    maxWidth,
    width: "max-content",
    zIndex: 300,
    pointerEvents: "none",
    animation: "enter-fade 140ms cubic-bezier(0.4,0,0.2,1)",
  };

  return createPortal(
    <div className={className} role={role} style={{ ...tokens, ...pos, ...style }}>
      {children}
    </div>,
    document.body,
  );
}
