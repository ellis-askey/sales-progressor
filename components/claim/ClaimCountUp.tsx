"use client";

import { useEffect, useState } from "react";

// Counts up from 0 to `value` once on mount (easeOutCubic), for the small
// progress figure inside the Joined pill on the share-link claim card. Purely
// decorative — the parent carries an aria-label with the real value, so screen
// readers get the final number, not the ticking one. Reduced-motion shows the
// final value immediately.
export function ClaimCountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{display}</>;
}
