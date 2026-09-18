"use client";

// Whole-page fade-in wrapper. Sits inside a layout's <main> so the first
// page under that layout fades in on initial load.
//
// Phase 3 perceived-performance (2026-09-18, PERF-15): the fade fires on
// FIRST MOUNT ONLY. It used to re-fire on every route change (keyed on
// pathname), which added a flat ~280-360ms of pure animation to every
// client-side navigation on top of the server render — the single biggest
// fixed tax on moving around the app. Client navigations now swap content
// in immediately; the entrance animation remains for hard loads, where it
// masks the initial paint.
//
// Match to the hub SectionReveal treatment:
//   opacity 0 → 1 over 280ms ease-out
//   translateY(8px) → 0 over 320ms ease-out
//   prefers-reduced-motion → snap to visible, no transform
//
// CRITICAL (2026-08-10): once the fade settles we DROP transform +
// will-change entirely. A lingering `transform: translateY(0)` or
// `will-change: transform` keeps this wrapper as a stacking/backdrop
// root, which severs every descendant card's backdrop-filter from the
// fixed WebGL AppBackground — the frost then samples nothing and the
// aurora shows through sharp. Removing them after the animation lets the
// glass actually blur the backdrop. During the ~360ms fade the root
// exists (unavoidable while animating opacity/transform); it's released
// the moment the page is settled.
//
// Kept intentionally light — no framer-motion, no exit animation, no
// stagger. The layout chrome (sidebar, top bar) stays static; only the
// main content region is wrapped.

import { useEffect, useState } from "react";

export function PageFadeIn({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // First mount only — client-side route changes must NOT replay the fade
    // (see docstring). The wrapper stays mounted across navigations because
    // it lives in the persistent layout, so this effect naturally runs once
    // per hard load.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const raf = window.requestAnimationFrame(() => setShown(true));
    // After the fade completes, release the backdrop root (see docstring).
    // 360ms clears the longest (320ms transform) transition + a frame.
    const t = window.setTimeout(() => setSettled(true), 360);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Settled: no inline transform/opacity/will-change → the wrapper is not a
  // backdrop root, so descendant glass blurs the aurora. The element itself
  // stays mounted (same <div>) so children never remount on settle.
  return (
    <div
      style={
        settled
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 280ms ease-out, transform 320ms ease-out",
              willChange: "opacity, transform",
            }
      }
    >
      {children}
    </div>
  );
}
