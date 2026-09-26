"use client";

// File-page tab content entrance (ij13f6). Applies the .file-tab-enter CSS
// animation (fade + rise) to a tab's content — it runs once when the element
// mounts, and because each tab is its own route segment the content remounts on
// navigation, so it replays every time you switch tabs. Respects reduced-motion.
//
// It also closes the tab-switch timing loop: FileTabsChrome stamps the click
// moment on window.__tspTabNavStart; on mount here (content painted) we report
// the delta to the Ellis-only TabTimingBadge so we can see the REAL click→
// content time on prod, not a guess.

import { useEffect } from "react";

export function TabEnter({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __tspTabNavStart?: number };
    const start = w.__tspTabNavStart;
    if (start) {
      w.__tspTabNavStart = 0;
      window.dispatchEvent(new CustomEvent("tsp-tab-painted", { detail: Math.round(performance.now() - start) }));
    }
  }, []);

  return <div className="file-tab-enter">{children}</div>;
}
