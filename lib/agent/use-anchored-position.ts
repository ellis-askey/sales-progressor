"use client";

// Anchored positioning for portalled floating UI (menus / tooltips / popovers).
// The float is portalled to <body> and positioned `fixed` in viewport coords, so
// it is NEVER trapped inside a card's overflow/transform and always sits on top.
// It flips above<->below by available space and shifts horizontally to stay on
// screen with an edge gutter — killing both the "clipped inside the card" and the
// "too close to the mobile edge" bugs. Recomputes on scroll + resize.

import { useLayoutEffect, useState, type RefObject } from "react";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export type AnchoredPos = { top: number; left: number; placement: Placement } | null;

export function useAnchoredPosition(
  anchorRef: RefObject<HTMLElement | null>,
  floatRef: RefObject<HTMLElement | null>,
  open: boolean,
  opts: { placement?: Placement; gap?: number; gutter?: number } = {},
): AnchoredPos {
  const { placement = "bottom-start", gap = 6, gutter = 10 } = opts;
  const [pos, setPos] = useState<AnchoredPos>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }

    function compute() {
      const a = anchorRef.current?.getBoundingClientRect();
      const f = floatRef.current;
      if (!a || !f) return;
      const fw = f.offsetWidth;
      const fh = f.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const wantsTop = placement.startsWith("top");
      const spaceBelow = vh - a.bottom - gutter;
      const spaceAbove = a.top - gutter;
      // Honour the asked side when it fits; otherwise go to whichever side has room.
      const below = wantsTop
        ? !(fh <= spaceAbove) && spaceBelow > spaceAbove
        : fh <= spaceBelow || spaceBelow >= spaceAbove;

      let top = below ? a.bottom + gap : a.top - gap - fh;
      top = Math.max(gutter, Math.min(top, vh - fh - gutter));

      // Horizontal: align the start edge (or end edge for *-end), then clamp.
      let left = placement.endsWith("end") ? a.right - fw : a.left;
      left = Math.max(gutter, Math.min(left, vw - fw - gutter));

      const resolved: Placement = below
        ? (placement.endsWith("end") ? "bottom-end" : "bottom-start")
        : (placement.endsWith("end") ? "top-end" : "top-start");
      setPos({ top, left, placement: resolved });
    }

    compute();
    // `true` = capture, so it also fires for scroll inside nested scroll containers.
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, gap, gutter]);

  return pos;
}
