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
//
// LATE ARRIVALS: a MutationObserver watches the subtree so `data-bloom` blocks
// that mount AFTER the first paint — a keyed view-swap remounting, a collapsed
// group expanding, a filtered list rebuilding — still bloom in instead of being
// stranded invisible by the first-paint hide. They fade in immediately (no
// document-order delay; the initial cascade is a load-in moment, later arrivals
// are reactions to a click and should feel instant).

import { useEffect, useRef } from "react";

export function BloomStage({
  children,
  className,
  style,
  step = 50,
  cap = 14,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Delay between successive blocks, ms. */
  step?: number;
  /** Max index that still increments the delay — the tail lands together. */
  cap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Reveal one block: flip it to visible and clean up its inline hints once the
    // fade has run, so nothing lingers to sever glass backdrop-filter.
    const reveal = (el: HTMLElement, delayMs: number) => {
      if (el.classList.contains("bloom-in")) return;
      el.style.transitionDelay = delayMs > 0 ? `${delayMs}ms` : "";
      el.style.willChange = "opacity, transform, filter";
      el.classList.add("bloom-in");
      const done = (e: TransitionEvent) => {
        if (e.propertyName !== "opacity") return; // once, after the opacity leg
        el.style.transitionDelay = "";
        el.style.willChange = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    };

    // The opening cascade runs once per mounted stage.
    if (!root.dataset.bloomArmed) {
      root.dataset.bloomArmed = "1";
      const items = Array.from(root.querySelectorAll<HTMLElement>("[data-bloom]"));
      // Items are already hidden (CSS). Flip to visible next frame so the browser
      // has painted the hidden state and the transition actually runs — staggered
      // in document order for the opening cascade.
      requestAnimationFrame(() => {
        items.forEach((el, i) => reveal(el, Math.min(i, cap) * step));
      });
    }

    // Late arrivals (keyed remounts, accordion expansions, re-filtered lists):
    // reveal them straight away so the first-paint hide never strands them. The
    // observer always attaches, even if the cascade was already armed.
    const observer = new MutationObserver((mutations) => {
      const fresh: HTMLElement[] = [];
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute("data-bloom")) fresh.push(node);
          node.querySelectorAll?.<HTMLElement>("[data-bloom]").forEach((el) => fresh.push(el));
        });
      }
      if (!fresh.length) return;
      requestAnimationFrame(() => fresh.forEach((el) => reveal(el, 0)));
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [cap, step]);

  return (
    <div ref={ref} className={className ? `bloom-stage ${className}` : "bloom-stage"} style={style}>
      {children}
    </div>
  );
}
