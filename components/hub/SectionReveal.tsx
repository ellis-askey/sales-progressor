"use client";

// Blooms a hub section in on mount — the universal load-in (2026-10-18):
// content arrives blurred + dropped, then sharpens + rises into place.
// blur 12px + translateY 32px → clear, 520ms cubic-bezier(0.25,0,0,1), with an
// `order * 50ms` cascade. Respects prefers-reduced-motion (renders children
// as-is). Matches .agent-bloom in agent-system.css; kept as a JS component
// because it must DROP transform/filter after settling — a residual transform
// or filter makes this a backdrop root and severs the section's glass cards'
// backdrop-filter from the fixed WebGL background (no frost). 2026-08-10.

import { useEffect, useState } from "react";

export function SectionReveal({
  children,
  order = 0,
}: {
  children: React.ReactNode;
  /**
   * Zero-based index within the parent's cascade → `transition-delay` of
   * `order * 50ms`. Only matters when multiple SectionReveals resolve within
   * the same frame; if they resolve over time the delay is invisible.
   */
  order?: number;
}) {
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const delayMs = Math.max(0, order) * 50;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    // rAF so the initial hidden state paints before the transition starts.
    const id = window.requestAnimationFrame(() => setShown(true));
    // Once bloomed in, drop transform/filter/will-change so this wrapper stops
    // being a backdrop root — otherwise the section's glass cards lose their
    // frost over the fixed WebGL background.
    const t = window.setTimeout(() => setSettled(true), 560 + delayMs);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [delayMs]);

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <div
      style={
        settled
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(32px)",
              filter: shown ? "blur(0)" : "blur(12px)",
              transition: `opacity 520ms cubic-bezier(0.25, 0, 0, 1) ${delayMs}ms, transform 520ms cubic-bezier(0.25, 0, 0, 1) ${delayMs}ms, filter 520ms cubic-bezier(0.25, 0, 0, 1) ${delayMs}ms`,
              willChange: "opacity, transform, filter",
            }
      }
    >
      {children}
    </div>
  );
}
