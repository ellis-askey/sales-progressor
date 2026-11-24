"use client";

// Tiny spring-driven interaction primitives for the lab. Reused by the nav
// variants so the glass feels physical (press → squash, tap → settle). Built on
// the same spring model as everything else.

import { useState, type ReactNode, type CSSProperties } from "react";
import { useSpringValue } from "./kit";

// A press target that squashes toward the pointer and springs back on release.
export function Press({
  children,
  className,
  onClick,
  squash = 0.9,
  label,
  style,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  squash?: number;
  label?: string;
  style?: CSSProperties;
}) {
  const [down, setDown] = useState(false);
  const scale = useSpringValue(down ? squash : 1, 0.26, 0.45);
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={onClick}
      style={{ transform: `scale(${scale})`, ...style }}
    >
      {children}
    </button>
  );
}

// A brief expanding ripple from the last tap point (optical "touch" on glass).
export function useTapRipple() {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  function trigger(e: { currentTarget: HTMLElement; clientX: number; clientY: number }) {
    const r = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - r.left, y: e.clientY - r.top, id: ripple ? ripple.id + 1 : 1 });
  }
  const node = ripple ? (
    <span key={ripple.id} className="pnl-ripple" style={{ left: ripple.x, top: ripple.y }} />
  ) : null;
  return { node, trigger };
}
