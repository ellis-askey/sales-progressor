"use client";

// Collapse (interaction audit, 2026-11-27). Smoothly grows / shrinks to fit its
// content using grid-template-rows 0fr <-> 1fr, so an expanding card grows in
// place instead of popping in and snapping the layout. Content stays mounted
// (better for assistive tech and keeps form state). Honours reduced motion
// (instant). Formalises the pattern a few components already use by hand.

import type { ReactNode } from "react";
import { motion } from "@/design/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

export function Collapse({ open, children, durationMs = motion.speedBase, className }: {
  open: boolean;
  children: ReactNode;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: reduced ? "none" : `grid-template-rows ${durationMs}ms ${motion.bloomEase}`,
      }}
    >
      {/* min-height: 0 is required for the row to collapse below content height. */}
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}
