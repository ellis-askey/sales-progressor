"use client";

// BloomStage — orchestrates the universal load-in across a WHOLE page so it
// flows top-to-bottom, left-to-right like the Loading & Entrance Studio (a CSS
// stagger only reaches one level; real pages nest across many components).
//
// NO FLASH: the blocks start hidden FROM FIRST PAINT via CSS
// (`.bloom-stage [data-bloom]`), so they're never shown-then-hidden. On mount we
// set each block's transition-delay in document order and add `.bloom-in`, which
// transitions it to visible. The end state is transform/filter: none, so nothing
// lingers to sever glass backdrop-filter. Reduced-motion shows everything at
// once (CSS media query + JS skip).
//
// Mark blocks with `data-bloom`; unmarked content is unaffected.

import { useEffect, useRef } from "react";

export function BloomStage({
  children,
  className,
  step = 50,
  cap = 14,
}: {
  children: React.ReactNode;
  className?: string;
  /** Delay between successive blocks, ms. */
  step?: number;
  /** Max index that still increments the delay — the tail lands together. */
  cap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (root.dataset.bloomArmed) return; // once per mount
    root.dataset.bloomArmed = "1";
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-bloom]"));
    // Items are already hidden (CSS). Flip to visible next frame so the browser
    // has painted the hidden state and the transition actually runs.
    requestAnimationFrame(() => {
      items.forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i, cap) * step}ms`;
        el.style.willChange = "opacity, transform, filter";
        el.classList.add("bloom-in");
        const done = (e: TransitionEvent) => {
          if (e.propertyName !== "opacity") return; // once, after the opacity leg
          el.style.transitionDelay = "";
          el.style.willChange = "";
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      });
    });
  }, []);

  return (
    <div ref={ref} className={className ? `bloom-stage ${className}` : "bloom-stage"}>
      {children}
    </div>
  );
}
