"use client";

// Canonical circular progress ring. Extracted 2026-11-21 from the hub's MomentumRing: a
// coral arc that animates its stroke-dashoffset in on mount (respecting reduced-motion),
// over a faint track, with a value label centred. Pass `value` (0–100); size / strokeWidth /
// label are optional.

import { useEffect, useState } from "react";

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 7,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Centre label. Defaults to `${value}%`. */
  label?: string;
}) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - strokeWidth - 1;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(100, Math.max(0, value)) / 100;
  const target = circ * (1 - progress);
  const [rm, setRm] = useState(false);
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setRm(true); setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(var(--agent-coral-base-rgb),0.18)" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="var(--agent-coral)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: rm ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: Math.round(size * 0.19), fontWeight: 600, fill: "var(--agent-text-primary)", fontFamily: "inherit" }}
      >
        {label ?? `${value}%`}
      </text>
    </svg>
  );
}
