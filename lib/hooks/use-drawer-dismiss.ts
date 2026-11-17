"use client";

// Mobile/tablet drawer chrome shared by the floating file-preview and completion
// panels (critique #285): lock the page behind, and swipe a bottom sheet down to
// dismiss. Desktop keeps its backdrop-less, list-stays-live behaviour — these
// only engage at the tablet/mobile breakpoints the caller gates them on.

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";

// Lock body scroll while active; restore the previous value on cleanup
// (stacked-safe — nested locks each restore what they found).
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

// Reactive media-query match — false on the server / first paint, then updates.
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return match;
}

// Swipe-down-to-dismiss for a bottom sheet. Spread `handlers` on a drag zone
// (e.g. a grab handle); apply `dragY` as a downward translate on the sheet and
// disable its transition while `dragging`. A drag past the threshold (or a quick
// flick) calls onDismiss; otherwise it snaps back. Inert when `enabled` is false.
export function useSwipeDown({
  enabled,
  onDismiss,
  threshold = 110,
}: {
  enabled: boolean;
  onDismiss: () => void;
  threshold?: number;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const startT = useRef(0);
  const live = useRef(0);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    startY.current = e.touches[0].clientY;
    startT.current = Date.now();
    live.current = 0;
    setDragging(true);
  }, [enabled]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    const v = dy > 0 ? dy : 0;
    live.current = v;
    setDragY(v);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (startY.current == null) return;
    const dy = live.current;
    const flick = dy > 40 && Date.now() - startT.current < 250;
    startY.current = null;
    setDragging(false);
    setDragY(0);
    if (dy >= threshold || flick) onDismiss();
  }, [onDismiss, threshold]);

  return { dragY, dragging, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
