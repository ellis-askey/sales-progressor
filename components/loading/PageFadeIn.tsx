"use client";

// Whole-page fade-in wrapper. Sits inside a layout's <main> so every
// page under that layout fades in on mount. Re-fires on route change
// via the pathname key so client-side navigation gets the same subtle
// entrance the initial load does.
//
// Match to the hub SectionReveal treatment:
//   opacity 0 → 1 over 280ms ease-out
//   translateY(8px) → 0 over 320ms ease-out
//   prefers-reduced-motion → snap to visible, no transform
//
// Kept intentionally light — no framer-motion, no exit animation, no
// stagger. The layout chrome (sidebar, top bar) stays static; only the
// main content region is wrapped.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function PageFadeIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Reset then arm — this handles both first mount and pathname change.
    setShown(false);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 280ms ease-out, transform 320ms ease-out",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
