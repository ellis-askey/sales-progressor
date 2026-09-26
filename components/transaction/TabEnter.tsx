"use client";

// File-page tab content entrance (ij13f6). Applies the .file-tab-enter CSS
// animation (fade + rise) to a tab's content — it runs once when the element
// mounts, and because each tab is its own route segment the content remounts on
// navigation, so it replays every time you switch tabs. Respects reduced-motion.
//
// It also closes the tab-switch timing loop (Ellis-only TabTimingBadge):
//   - a tab SWITCH: FileTabsChrome stamps the click on window.__tspTabNavStart;
//     on mount here we report the delta (click → content painted).
//   - the INITIAL landing (hard load into a file): the first TabEnter mount in a
//     fresh page context reports performance.now() (~ms since navigation start),
//     so the Overview/landing time is measurable too, not just swaps.

import { useEffect } from "react";

// Module scope: persists across SPA navigations, resets on a hard load. Ensures
// the "initial load" number is reported once, for the tab you actually land on.
let reportedInitial = false;

export function TabEnter({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __tspTabNavStart?: number };
    const start = w.__tspTabNavStart;
    if (start) {
      w.__tspTabNavStart = 0;
      window.dispatchEvent(new CustomEvent("tsp-tab-painted", { detail: { ms: Math.round(performance.now() - start), kind: "switch" } }));
    } else if (!reportedInitial) {
      reportedInitial = true;
      window.dispatchEvent(new CustomEvent("tsp-tab-painted", { detail: { ms: Math.round(performance.now()), kind: "load" } }));
    }
  }, []);

  return <div className="file-tab-enter">{children}</div>;
}
