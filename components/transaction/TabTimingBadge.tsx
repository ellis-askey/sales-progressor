"use client";

// TEMP diagnostic (Ellis-only), pairs with ShellTimingBadge. Shows the REAL
// tab-switch time: from the tab click (stamped in FileTabsChrome) to the new
// tab's content painting (reported by TabEnter). This is the number the
// skeleton wait actually is — so we optimise ij13f6 against measurement, not a
// guess. Remove once tab speed is signed off.

import { useEffect, useState } from "react";

export function TabTimingBadge({ enabled }: { enabled: boolean }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: Event) => setMs((e as CustomEvent).detail as number);
    window.addEventListener("tsp-tab-painted", handler);
    return () => window.removeEventListener("tsp-tab-painted", handler);
  }, [enabled]);

  if (!enabled || ms == null) return null;
  const color = ms > 800 ? "#f87171" : ms > 300 ? "#fbbf24" : "#4ade80";
  return (
    <div
      style={{
        position: "fixed", bottom: 10, right: 10, zIndex: 99999,
        background: "rgba(10,10,12,0.92)", color: "#e5e7eb",
        border: "1px solid #333", borderRadius: 8, padding: "7px 10px",
        font: "600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
        display: "flex", gap: 8, alignItems: "baseline", boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>tab switch</span>
      <b style={{ color, fontVariantNumeric: "tabular-nums" }}>{ms}ms</b>
    </div>
  );
}
