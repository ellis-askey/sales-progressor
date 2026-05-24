// lib/hooks/useCountUp.ts
//
// Per-page JS animation pattern — number count-up. Documented in
// docs/polish-pass/ANIMATION_STANDARDS.md under "Per-page JS patterns"
// (peers: A5 tab indicator, H1 status crossfade). Not a canonical CSS class
// because the value being animated is a runtime number, not a presentational
// state change.
//
// Usage:
//   const display = useCountUp(targetValuePence, { duration: 600 });
//   return <span>{formatPence(display)}</span>;
//
// Behaviour:
//   - Mounts at 0, eases to the target over `duration` ms.
//   - When the target changes mid-animation, retargets smoothly from the
//     current display value (so a "new line landed" tick feels right).
//   - Respects prefers-reduced-motion via the global data-rm contract:
//     when set, snaps to the final value, no animation.
//
// Easing: ease-out cubic — fast at start, slow at the end (number arrives
// at its resting place rather than rushing past).

import { useEffect, useRef, useState } from "react";

export type UseCountUpOptions = {
  /** Animation duration in ms. Default 600ms — calm enough for money UIs. */
  duration?: number;
  /** First mount only — skip the animation and show target immediately. */
  initialSnap?: boolean;
};

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 600, initialSnap = false } = options;
  const [display, setDisplay] = useState<number>(initialSnap ? target : 0);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(initialSnap ? target : 0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Reduced-motion: snap, no animation.
    if (typeof document !== "undefined" && document.documentElement.dataset.rm === "1") {
      setDisplay(target);
      return;
    }
    if (display === target) return;

    startValueRef.current = display;
    startTimeRef.current = performance.now();

    function frame(now: number) {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = startValueRef.current + (target - startValueRef.current) * eased;
      setDisplay(t === 1 ? target : value);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
