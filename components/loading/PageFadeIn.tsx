"use client";

// Whole-page fade-in wrapper. Sits inside a layout's <main> so every page
// under that layout gets a short entrance as it arrives.
//
// History: the original 280-360ms fade re-fired on every navigation and
// stacked ON TOP of seconds of server render — Phase 3 (PERF-15) cut it to
// first-mount-only. The instant-shell slice (2026-09-18, founder direction)
// brings the per-navigation entrance BACK, but shorter (180ms/6px) and in a
// changed world: navigation now commits instantly (full-prefetched rail,
// route skeletons), so this reads as "the page arriving", not added wait.
// It never blocks input — pointer events stay live throughout.
//
//   opacity 0 → 1 over 180ms ease-out
//   translateY(6px) → 0 over 200ms ease-out
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
import { usePathname } from "next/navigation";

export function PageFadeIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Reset then arm — runs on first mount and on every route change, so
    // each arriving page plays the short entrance (see docstring).
    setShown(false);
    setSettled(false);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const raf = window.requestAnimationFrame(() => setShown(true));
    // After the fade completes, release the backdrop root (see docstring).
    // 240ms clears the longest (200ms transform) transition + a frame.
    const t = window.setTimeout(() => setSettled(true), 240);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [pathname]);

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
              transform: shown ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 180ms ease-out, transform 200ms ease-out",
              willChange: "opacity, transform",
            }
      }
    >
      {children}
    </div>
  );
}
