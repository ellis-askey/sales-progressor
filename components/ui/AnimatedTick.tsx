"use client";

// components/ui/AnimatedTick.tsx
//
// The canonical "tick draws in" checkmark. Reuses the exact stroke-draw the
// app already uses for the to-do completion tick (.todo-tick-path +
// .todo-hover-tick[-show] in app/agent/styles/agent-system.css) — here it
// fires once on mount instead of on hover, so a confirmation tick animates
// itself in wherever it appears.
//
// Respects reduced-motion for free: the .todo-tick-path transition is the only
// motion, and the global reduced-motion block neutralises keyframe/transition
// motion elsewhere; with reduced motion the tick simply appears drawn.

import { useEffect, useState } from "react";

export function AnimatedTick({
  size = 14,
  color = "var(--agent-success)",
  strokeWidth = 3.5,
  delayMs = 0,
  style,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Small stagger so a tick that appears alongside other content lands after it. */
  delayMs?: number;
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delayMs + 20);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <svg
      className={`todo-hover-tick${shown ? " todo-hover-tick-show" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      <polyline className="todo-tick-path" points="20 6 9 17 4 12" />
    </svg>
  );
}
