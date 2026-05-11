import { useRef, useState, useEffect } from "react";

/**
 * Measures each tab button's offsetLeft + offsetWidth and returns a
 * { left, width } position for a sliding underline indicator bar.
 *
 * Usage:
 *   const { btnRefs, ind } = useTabIndicator(activeIdx);
 *   // Attach btnRefs.current[i] to each tab button via ref callback
 *   // Render the indicator bar only when ind !== null (avoids 0,0 flash on first paint)
 *
 * Transition (consumer responsibility):
 *   transition: rm ? "none" : "left 200ms ease, width 200ms ease"
 *
 * Documented in docs/polish-pass/ANIMATION_STANDARDS.md § A5.
 */
export function useTabIndicator(activeIdx: number) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = btnRefs.current[activeIdx];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeIdx]);

  return { btnRefs, ind };
}
