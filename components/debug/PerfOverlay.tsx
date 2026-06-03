"use client";

// Tiny perf overlay for the file-detail page. Renders only when ?perf=1 is
// on the URL. Shows server-side per-query timings (collected in the page
// server component and passed in as props) and the client-side navigation
// timings from the Performance API (TTFB, DOM content loaded, etc).
//
// Removable once we've finished the perf investigation — search for
// PerfOverlay across the codebase and delete the import + the JSX usage.

import { useEffect, useState } from "react";

type Timing = { label: string; ms: number };

type Props = {
  serverTimings: Timing[];
  stage1ElapsedMs: number;
  stage2ElapsedMs: number;
  totalServerMs: number;
  renderedAtIso: string;
};

export function PerfOverlay({
  serverTimings,
  stage1ElapsedMs,
  stage2ElapsedMs,
  totalServerMs,
  renderedAtIso,
}: Props) {
  const [navTimings, setNavTimings] = useState<{
    ttfb: number;
    domContentLoaded: number;
    loadEvent: number;
  } | null>(null);

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return;
    setNavTimings({
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
    });
  }, []);

  const stage1Slowest = [...serverTimings]
    .filter((t) => t.label.startsWith("s1:"))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);
  const stage2Slowest = [...serverTimings]
    .filter((t) => t.label.startsWith("s2:"))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.96)",
        color: "#f1f5f9",
        fontFamily: "SF Mono, Consolas, monospace",
        fontSize: 11,
        padding: "10px 14px",
        borderRadius: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        maxWidth: 360,
        lineHeight: 1.5,
        border: "1px solid #334155",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#fbbf24" }}>
        perf · file-detail
      </div>
      <div style={{ marginBottom: 8 }}>
        <div>Server total: <strong>{totalServerMs}ms</strong></div>
        <div>Stage 1 (main fan-out): {stage1ElapsedMs}ms</div>
        <div>Stage 2 (post-tx fan-out): {stage2ElapsedMs}ms</div>
        <div style={{ color: "#94a3b8", fontSize: 10 }}>rendered {renderedAtIso}</div>
      </div>
      {navTimings && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "#94a3b8", marginBottom: 2 }}>client (Performance API)</div>
          <div>TTFB: {navTimings.ttfb}ms</div>
          <div>DOM ready: {navTimings.domContentLoaded}ms</div>
          <div>Load event: {navTimings.loadEvent}ms</div>
        </div>
      )}
      <div style={{ marginBottom: 4, color: "#94a3b8" }}>stage 1 slowest</div>
      {stage1Slowest.map((t) => (
        <div key={t.label}>
          <span style={{ color: "#94a3b8" }}>{t.label.replace(/^s1:/, "")}</span>{" "}
          <strong style={{ color: t.ms > 500 ? "#fb7185" : t.ms > 200 ? "#fbbf24" : "#a7f3d0" }}>{t.ms}ms</strong>
        </div>
      ))}
      {stage2Slowest.length > 0 && (
        <>
          <div style={{ marginTop: 6, marginBottom: 4, color: "#94a3b8" }}>stage 2 slowest</div>
          {stage2Slowest.map((t) => (
            <div key={t.label}>
              <span style={{ color: "#94a3b8" }}>{t.label.replace(/^s2:/, "")}</span>{" "}
              <strong style={{ color: t.ms > 500 ? "#fb7185" : t.ms > 200 ? "#fbbf24" : "#a7f3d0" }}>{t.ms}ms</strong>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
