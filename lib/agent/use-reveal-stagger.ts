"use client";

import { useCallback, useEffect, useRef, type MutableRefObject, type Ref, type RefCallback, type RefObject } from "react";

// Combine several refs (callback or object) onto one element — e.g. an
// auto-animate callback ref plus a useRevealStagger RefObject on the same list
// container. Returns a stable callback ref (deps are the refs themselves, which
// are stable across renders for useRef / useAutoAnimate).
export function useMergedRefs<T>(...refs: Array<Ref<T> | null | undefined>): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((el: T | null) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(el);
      else (r as MutableRefObject<T | null>).current = el;
    }
  }, refs);
}

// Staggered "bloom" reveal for a disclosure's contents. When `open` flips to
// true (after the initial mount), each direct child of the returned ref's
// element animates in with the canonical agent-bloom (blur + rise + fade),
// `step` ms apart — the same load-in the page cascade uses, fired on expand.
// This is what makes collapsing/revealing a drawer feel alive instead of a
// bare height-slide.
//
// Only runs on the open TOGGLE, never on first mount: a section already open on
// load is handled by the page's own entrance cascade, so we never double-
// animate. `backwards` fill holds each item hidden through its delay, and the
// inline animation is cleared on animationend so nothing lingers to sever a
// glass card's backdrop-filter. Reduced-motion is a no-op.
//
// Attach the returned ref to the element whose DIRECT CHILDREN are the rows or
// cards to stagger.
export function useRevealStagger<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  opts?: { step?: number; cap?: number },
): RefObject<T> {
  const ref = useRef<T>(null);
  const mounted = useRef(false);
  const step = opts?.step ?? 45;
  const cap = opts?.cap ?? 10;

  useEffect(() => {
    // Skip the initial mount — the page entrance owns the first paint.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.children) as HTMLElement[];
    const cleanups: Array<() => void> = [];
    items.forEach((child, i) => {
      child.style.animation = "none";
      // Force a reflow so re-adding the animation restarts it on every open.
      void child.offsetWidth;
      const delay = Math.min(i, cap) * step;
      child.style.animation = `agent-bloom 480ms cubic-bezier(0.25, 0, 0, 1) ${delay}ms backwards`;
      const done = () => {
        child.style.animation = "";
        child.removeEventListener("animationend", done);
      };
      child.addEventListener("animationend", done);
      cleanups.push(() => {
        child.removeEventListener("animationend", done);
        child.style.animation = "";
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, [open, step, cap]);

  return ref;
}
