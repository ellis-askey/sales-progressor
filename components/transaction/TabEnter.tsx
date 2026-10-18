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
import { BloomStage } from "@/components/agent/BloomStage";

// Module scope: persists across SPA navigations, resets on a hard load. Ensures
// the "initial load" number is reported once, for the tab you actually land on.
let reportedInitial = false;

// `stage` opts a tab into the per-item cascade (BloomStage walks its [data-bloom]
// blocks in document order). Without it, the whole tab blooms as one block
// (.agent-bloom). `passthrough` renders the children with no wrapper animation at
// all — for tabs whose body already owns a single BloomStage (Reminders, Chain),
// where a second orchestrator would double-arm and flash. Either way the timing
// telemetry below still fires on mount.
export function TabEnter({ children, stage = false, passthrough = false }: { children: React.ReactNode; stage?: boolean; passthrough?: boolean }) {
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

  if (passthrough) return <>{children}</>;
  return stage ? <BloomStage>{children}</BloomStage> : <div className="agent-bloom">{children}</div>;
}
