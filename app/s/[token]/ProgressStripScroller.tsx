"use client";

import { useEffect, useRef, useState } from "react";

// Horizontal scroller for the progress strip that fades its content at whichever
// edge is currently clipped, via a mask. At rest (scrolled to the start) only the
// right edge fades; once you scroll, the left edge fades in too; at the very end
// the right fade drops and only the left stays. Uses a mask so it fades to
// transparent regardless of the glass card behind it (never a hard clip).
const FADE = 28;

export function ProgressStripScroller({ children }: { children: React.ReactNode }) {
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
    setMask(`linear-gradient(to right, ${leftCol} 0px, black ${FADE}px, black calc(100% - ${FADE}px), ${rightCol} 100%)`);
  }

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

  return (
    <div
      ref={ref}
      onScroll={update}
      className="scrollbar-hide"
      style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: 2, maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
