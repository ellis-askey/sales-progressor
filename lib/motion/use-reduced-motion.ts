"use client";

// Canonical reduced-motion gate (interaction audit, 2026-11-27). One hook every
// JS-driven animation can check, so a viewer who has turned on "reduce motion"
// gets a still, calm UI. CSS already honours prefers-reduced-motion in many
// places; this covers the animations driven from React. Pairs with the speed
// scale in design/tokens.ts (motion.speed*).

import { useState, useEffect } from "react";

/**
 * Live prefers-reduced-motion preference. Returns false during SSR and on the
 * first client paint, then updates once the media query is read (and whenever
 * the OS preference changes). Safe in any client component.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return reduced;
}
