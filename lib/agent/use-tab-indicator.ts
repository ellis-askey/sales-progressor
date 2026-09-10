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
export function useTabIndicator(activeIdx: number, ...deps: unknown[]) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = btnRefs.current[activeIdx];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    // Extra deps let a consumer force a re-measure once the tab buttons exist —
    // e.g. a drawer whose tabs mount only after an async load, so the default
    // tab's underline appears on open, not just after the first click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, ...deps]);

  return { btnRefs, ind };
}
