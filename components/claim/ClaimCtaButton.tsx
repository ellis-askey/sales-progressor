"use client";

import { useEffect, useRef } from "react";

/**
 * The primary claim CTA (both A/B card variants). Renders the same .claim-btn
 * anchor, plus a single shine sweep: the first time the pointer moves anywhere
 * over the surrounding card, the button flashes one glint — then it's capped and
 * never fires again for the life of the page. Skipped under prefers-reduced-motion.
 */
export function ClaimCtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Variant A wraps content in .claim-container; variant B in .claim-b-wrap.
    const container = btn.closest(".claim-container, .claim-b-wrap");
    if (!container) return;

    // Once and done: { once: true } auto-removes the listener after the first
    // pointer move, so the glint plays a single time per page load.
    const trigger = () => btn.classList.add("claim-btn--shine");
    container.addEventListener("mousemove", trigger, { once: true });
    return () => container.removeEventListener("mousemove", trigger);
  }, []);

  return (
    <a ref={ref} href={href} className="claim-btn">
      {children}
    </a>
  );
}
