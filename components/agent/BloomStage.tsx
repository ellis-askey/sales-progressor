"use client";

// BloomStage — orchestrates the universal load-in across a WHOLE page, so it
// flows top-to-bottom, left-to-right like the Loading & Entrance Studio (not
// just one repeating group). A CSS stagger only reaches an element's direct
// children; real pages are nested across many components, so to get one
// continuous cascade we collect every [data-bloom] block in document order and
// give each an increasing animation-delay, then play .agent-bloom.
//
// Mark the blocks you want in the flow with `data-bloom` (stat cards, bars,
// search, tabs, rows…). Unmarked content simply appears. Runs in useLayoutEffect
// (before paint) so there's no flash on client navigation; reduced-motion skips
// it entirely. On each block's animationend we strip the class + inline delay so
// no residual transform/filter lingers (which would sever glass backdrop-filter).

import { useLayoutEffect, useRef } from "react";

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

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (root.dataset.bloomArmed) return; // once per mount (guards strict-mode double-invoke)
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.dataset.bloomArmed = "1";

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-bloom]"));
    items.forEach((el, i) => {
      el.style.animationDelay = `${Math.min(i, cap) * step}ms`;
      el.classList.add("agent-bloom");
      const clear = (e: AnimationEvent) => {
        if (e.animationName !== "agent-bloom") return; // ignore unrelated animations
        el.classList.remove("agent-bloom");
        el.style.animationDelay = "";
        el.removeEventListener("animationend", clear);
      };
      el.addEventListener("animationend", clear);
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
