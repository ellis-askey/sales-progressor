"use client";

// Reveals a hub section in on mount — the universal load-in (2026-10-18). The
// section starts hidden (CSS, so there's no flash), then on mount we add
// .section-bloom-in and it transitions in.
//
// GLASS-SAFE (2026-10-18): a backdrop-filter frost switches OFF whenever an
// ANCESTOR is transformed or blurred, so moving a wrapper *around* a glass card
// killed its frost for the whole animation and snapped it back at the end — a
// white flash. Fix: for sections that wrap a glass card the rise + blur is hung
// on the CARD ITSELF (its own transform/filter don't break its own frost) while
// the wrapper only fades; non-glass sections still animate the wrapper (see the
// .section-bloom rules in agent-system.css). Below we give that card the same
// transition-delay as the wrapper so they move in step, and we set NO
// will-change — `will-change: transform/filter` on the glass ancestor would
// re-trigger the very flash we're removing.
//
// `order` adds `order * 50ms` of transition-delay so sections cascade
// top-to-bottom. Reduced-motion shows them at once (CSS media query + JS skip).

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
    // For a glass section the rise+blur lives on the CARD (so its frost survives
    // the motion); it needs the same delay as the wrapper's fade to stay in step.
    const card = el.querySelector<HTMLElement>("[data-glass-id]");
    // Paint the hidden state first, then flip so the transition actually runs.
    const raf = requestAnimationFrame(() => {
      el.style.transitionDelay = `${delay}ms`;
      if (card) card.style.transitionDelay = `${delay}ms`;
      el.classList.add("section-bloom-in");
      const done = (e: TransitionEvent) => {
        if (e.propertyName !== "opacity") return; // once, after the opacity leg
        el.style.transitionDelay = "";
        if (card) card.style.transitionDelay = "";
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
