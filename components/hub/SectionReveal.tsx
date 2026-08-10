"use client";

// Fades a hub section in on mount. Opacity 0 → 1 (~280ms), translateY
// 8px → 0 (~320ms), ease-out. Respects prefers-reduced-motion: no
// transform, opacity snaps to 1 immediately.
//
// The `order` prop adds a `transition-delay` of `order * 40ms`. On a fast
// network (localhost, warm cache) all sections resolve near-simultaneously
// so without this they all fade at the same instant and read as one big
// flash. The 40ms cascade gives a natural top-to-bottom choreography.
// On slower networks where sections resolve seconds apart, the 40ms
// order-delay is invisible relative to the fetch time — so it never
// artificially delays a section that would otherwise appear earlier.
//
// Deliberately lightweight: no framer-motion, no exit animation, no
// arbitrary keyframes. Content appears the moment its data is ready,
// with a subtle fade-up on top for polish.

import { useEffect, useState } from "react";

export function SectionReveal({
  children,
  order = 0,
}: {
  children: React.ReactNode;
  /**
   * Zero-based index within the parent's cascade. Passes through to a
   * transition-delay of `order * 40ms`. Only matters when multiple
   * SectionReveals resolve within the same frame; if they resolve
   * independently over time, the delay is invisible.
   */
  order?: number;
}) {
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const delayMs = Math.max(0, order) * 40;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    // rAF to guarantee the initial `opacity: 0` paints before the transition
    // starts — without it React can batch the state flip into the same frame
    // as mount and the fade is skipped.
    const id = window.requestAnimationFrame(() => setShown(true));
    // Once faded in, drop transform + will-change so this wrapper stops being
    // a backdrop root — otherwise it severs the section's glass cards'
    // backdrop-filter from the fixed WebGL background (no frost). 2026-08-10.
    const t = window.setTimeout(() => setSettled(true), 360 + delayMs);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [delayMs]);

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Settled: no inline transform/opacity/will-change → not a backdrop root,
  // so descendant glass blurs the aurora. Same <div> stays mounted.
  return (
    <div
      style={
        settled
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 280ms ease-out ${delayMs}ms, transform 320ms ease-out ${delayMs}ms`,
              willChange: "opacity, transform",
            }
      }
    >
      {children}
    </div>
  );
}
