"use client";

// MorphIcon (interaction audit, 2026-11-27). Crossfades + slightly scales/rotates
// between two icon states so a state change reads as the SAME control changing,
// not a hard swap (copy -> tick, eye open -> shut, chevron down -> up). Pure CSS
// transition; no dependency. Honours reduced motion (instant swap). Decorative:
// the surrounding control carries the real label / aria state.

import type { ReactNode } from "react";
import { motion } from "@/design/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

export function MorphIcon({ active, a, b, size = 18 }: {
  /** false shows `a`, true shows `b`. */
  active: boolean;
  a: ReactNode;
  b: ReactNode;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const transition = reduced ? "none" : `opacity ${motion.speedFast}ms ${motion.ease}, transform ${motion.speedFast}ms ${motion.ease}`;
  const layer = (show: boolean): React.CSSProperties => ({
    gridArea: "1 / 1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition,
    opacity: show ? 1 : 0,
    transform: reduced ? "none" : show ? "scale(1) rotate(0)" : "scale(0.6) rotate(-30deg)",
    pointerEvents: "none",
  });
  return (
    <span aria-hidden style={{ display: "inline-grid", width: size, height: size }}>
      <span style={layer(!active)}>{a}</span>
      <span style={layer(active)}>{b}</span>
    </span>
  );
}
