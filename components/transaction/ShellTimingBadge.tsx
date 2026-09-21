"use client";

// TEMP diagnostic (Ellis-only): shows how long the file shell's blocking render
// took on the server, broken down by phase, so we can see exactly what the
// 3-5s skeleton is waiting on. Remove once the file-open perf is nailed.
// Server measures each awaited phase with Date.now(); this just displays them.

import { useEffect, useState } from "react";

export function ShellTimingBadge({
  trunkMs,
  barrierMs,
  exchMs,
  shellMs,
}: {
  trunkMs: number;
  barrierMs: number;
  exchMs: number;
  shellMs: number;
}) {
  const [hidden, setHidden] = useState(false);
  // Client paint delta: ms from this component's module first evaluating to
  // its effect firing — a rough "hydration settled" marker on top of the
  // server numbers. Not a cross-navigation total, just a sanity signal.
  const [clientMs, setClientMs] = useState<number | null>(null);
  useEffect(() => {
    setClientMs(Math.round(performance.now()));
  }, []);

  if (hidden) return null;

  const cell = (label: string, ms: number, warn = false) => (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "baseline" }}>
      <span style={{ opacity: 0.55 }}>{label}</span>
      <b style={{ color: ms > 800 ? "#f87171" : ms > 300 ? "#fbbf24" : "#4ade80", fontVariantNumeric: "tabular-nums" }}>{ms}</b>
    </span>
  );

  return (
    <div
      style={{
        position: "fixed", bottom: 10, left: 10, zIndex: 99999,
        background: "rgba(10,10,12,0.92)", color: "#e5e7eb",
        border: "1px solid #333", borderRadius: 8, padding: "7px 10px",
        font: "600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
        display: "flex", gap: 12, alignItems: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>shell</span>
      {cell("total", shellMs, true)}
      {cell("trunk", trunkMs)}
      {cell("barrier", barrierMs)}
      {cell("exch", exchMs)}
      {clientMs != null && cell("perf.now", clientMs)}
      <button
        type="button"
        onClick={() => setHidden(true)}
        style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}
        aria-label="Hide timing"
      >
        ×
      </button>
    </div>
  );
}
