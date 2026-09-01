"use client";

import { useEffect, useState } from "react";

// Tracks prefers-reduced-motion. The app handles reduced motion globally in
// CSS for its canonical classes (MOTION_GUIDE.md), but the tour drives spotlight
// movement + scrolling from JS, so it needs the value at runtime: no scroll
// animation, no ring transition, instant tab swaps when this is true.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
