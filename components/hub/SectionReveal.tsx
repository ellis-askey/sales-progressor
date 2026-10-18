"use client";

// Reveals a hub section in on mount — the universal load-in (2026-10-18). Same
// smooth mechanism as BloomStage (the files list): the section starts hidden
// (CSS .section-bloom: opacity 0 + translateY 32px + blur 12px), then on mount
// we add .section-bloom-in and it transitions to opacity 1 / transform:none /
// filter:none. Because it ends at `none` (not translateY(0)/blur(0)), the glass
// frost re-engages DURING the motion — no post-animation settle-jump (the old
// timer-based style-swap caused that). will-change is cleared on transitionend.
//
// `order` adds `order * 50ms` of transition-delay so sections that resolve in
// the same frame cascade top-to-bottom. Reduced-motion shows them at once (CSS
// media query + JS skip).

import { useEffect, useRef } from "react";

export function SectionReveal({
  children,
  order = 0,
}: {
  children: React.ReactNode;
  /** Zero-based position in the top-to-bottom cascade (→ order * 50ms delay). */
  order?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const delay = Math.max(0, order) * 50;
    // Paint the hidden state first, then flip so the transition actually runs.
    const raf = requestAnimationFrame(() => {
      el.style.transitionDelay = `${delay}ms`;
      el.style.willChange = "opacity, transform, filter";
      el.classList.add("section-bloom-in");
      const done = (e: TransitionEvent) => {
        if (e.propertyName !== "opacity") return; // once, after the opacity leg
        el.style.willChange = "";
        el.style.transitionDelay = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    });
    return () => cancelAnimationFrame(raf);
  }, [order]);

  return (
    <div ref={ref} className="section-bloom">
      {children}
    </div>
  );
}
