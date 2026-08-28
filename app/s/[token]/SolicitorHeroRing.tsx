"use client";

import { useEffect, useState } from "react";
import { S } from "./ui";

// The hero progress ring, animated on load: the arc fills in from empty and the
// stage number counts up to its target. Honours reduced motion (the boot script
// / appearance toggle set data-portal-motion, and the OS pref) by snapping
// straight to the final state.
export function SolicitorHeroRing({ percent, step }: { percent: number; step: number }) {
  const size = 92;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const [shownPercent, setShownPercent] = useState(0);
  const [shownStep, setShownStep] = useState(0);

  useEffect(() => {
    const reduced =
      document.documentElement.getAttribute("data-portal-motion") === "reduced" ||
      (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    if (reduced || step <= 0) {
      setShownPercent(percent);
      setShownStep(step);
      return;
    }

    // Arc: mount at 0, then flip to the target next frame so the CSS transition tweens it.
    const arcRaf = requestAnimationFrame(() => setShownPercent(percent));

    // Number: ease-out count up over ~900ms to match the arc.
    const duration = 900;
    const start = performance.now();
    let countRaf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShownStep(Math.round(eased * step));
      if (p < 1) countRaf = requestAnimationFrame(tick);
    };
    countRaf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(arcRaf);
      cancelAnimationFrame(countRaf);
    };
  }, [percent, step]);

  const clamped = Math.min(100, Math.max(0, shownPercent));
  const offset = c * (1 - clamped / 100);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: S.heroText }}>{shownStep}</span>
        <span style={{ fontSize: 10, fontWeight: 500, color: S.heroTextSoft, marginTop: 2 }}>of 6</span>
      </div>
    </div>
  );
}
