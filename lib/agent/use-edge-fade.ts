import { useEffect, useRef, useState } from "react";

// Edge-fade mask for a horizontal scroller — the same behaviour as the portal
// ProgressStripScroller, extracted so both can share it. Fades whichever edge
// is currently clipped (never a blunt cut-off), and drops the fade on an edge
// once you've scrolled fully to it: at rest only the right fades; once you move
// the left fades in; at the far right only the left stays. No fade at all when
// the content isn't overflowing.
//
// Returns a ref for the scroll element, an onScroll handler, and the mask
// string to apply as maskImage / WebkitMaskImage. Recomputes on scroll, on
// resize (ResizeObserver + window), and after every render (so a change in the
// scrolled content's width — e.g. a segment filter dropping columns — is
// caught); the setState is guarded so an unchanged mask never re-renders.

const FADE = 28;

export function useEdgeFadeMask() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mask, setMask] = useState<string>(
    `linear-gradient(to right, black 0px, black ${FADE}px, black calc(100% - ${FADE}px), transparent 100%)`,
  );

  function update() {
    const el = ref.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    const leftCol = overflowing && !atStart ? "transparent" : "black";
    const rightCol = overflowing && !atEnd ? "transparent" : "black";
    const next = `linear-gradient(to right, ${leftCol} 0px, black ${FADE}px, black calc(100% - ${FADE}px), ${rightCol} 100%)`;
    setMask((prev) => (prev === next ? prev : next));
  }

  // After every render — catches content-width changes (e.g. a segment filter
  // changing how many columns there are). Guarded setState avoids a loop.
  useEffect(update);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, onScroll: update, mask };
}
