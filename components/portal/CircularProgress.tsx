"use client";

import { useEffect, useRef, useState } from "react";

export function CircularProgress({ percent }: { percent: number }) {
  const size = 68;
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;

  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  const rafRef  = useRef<number | null>(null);

  useEffect(() => {
    const start  = prevRef.current;
    const end    = percent;
    const dur    = 700;
    const t0     = performance.now();

    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [percent]);

  const dash = (displayed / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke="rgba(255,255,255,0.92)" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dasharray 0.05s linear" }}
      />
      <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill="white" fontFamily="-apple-system, sans-serif">
        {displayed}%
      </text>
    </svg>
  );
}
