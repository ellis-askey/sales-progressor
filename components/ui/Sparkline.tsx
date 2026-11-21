"use client";

// Canonical sparkline — a resolution-accurate mini line chart. Extracted 2026-11-21 from the
// hub's ExchangeSparkline (the shipped treatment, promoted verbatim): draws to REAL pixels
// (measured via ResizeObserver, SVG width = measured px with a matching viewBox, non-scaling
// stroke) so the line never stretches or flattens on a wide card. A coral line with an
// emphasised endpoint dot; pass an optional `tooltip` to enable hover/touch scrub (press-and-
// drag on touch with a light haptic tick, silent on iOS). Omit `tooltip` for a static spark.
// Parents can stay server components and just hand over the series.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChartTipPortal } from "@/components/agent/ChartTipPortal";

export function Sparkline({
  values,
  height = 44,
  color = "var(--agent-coral)",
  tooltip,
}: {
  values: number[];
  height?: number;
  /** Line + endpoint colour. Defaults to the coral accent. */
  color?: string;
  /** Scrub tooltip content for the active point. Provided → hover/touch scrub is enabled. */
  tooltip?: (index: number, value: number, total: number) => ReactNode;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(240);
  const [active, setActive] = useState<number | null>(null);
  const lastActive = useRef<number | null>(null);
  const interactive = typeof tooltip === "function";

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    if (el.clientWidth > 0) setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = values.length;
  const max = Math.max(1, ...values);
  const padL = 5, padR = 5, padT = 9, padB = 8;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = height - padT - padB;
  const xAt = (i: number) => padL + (n < 2 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;
  const pts = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

  const pick = useCallback(
    (clientX: number) => {
      const el = mountRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const pw = Math.max(1, rect.width - padL - padR);
      const step = n < 2 ? pw : pw / (n - 1);
      const i = Math.max(0, Math.min(n - 1, Math.round((x - padL) / step)));
      if (i !== lastActive.current) {
        lastActive.current = i;
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(5);
        }
        setActive(i);
      }
    },
    [n],
  );

  const clear = () => {
    lastActive.current = null;
    setActive(null);
  };

  if (n === 0) return null;

  return (
    <div
      ref={mountRef}
      style={{
        position: "relative",
        width: "100%",
        touchAction: "none",
        cursor: interactive ? "crosshair" : "default",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onPointerMove={interactive ? (e) => pick(e.clientX) : undefined}
      onPointerDown={interactive ? (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e.clientX); } : undefined}
      onPointerLeave={interactive ? clear : undefined}
      onPointerCancel={interactive ? clear : undefined}
    >
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        style={{ display: "block", width: "100%" }}
        aria-hidden
      >
        {active != null && (
          <line
            x1={xAt(active)}
            y1={padT - 3}
            x2={xAt(active)}
            y2={height - padB + 2}
            stroke="var(--agent-text-muted)"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.6}
          />
        )}
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xAt(n - 1)} cy={yAt(values[n - 1])} r={3} fill={color} />
        {active != null && (
          <>
            <circle cx={xAt(active)} cy={yAt(values[active])} r={7} fill={color} opacity={0.18} />
            <circle cx={xAt(active)} cy={yAt(values[active])} r={4} fill={color} />
          </>
        )}
      </svg>
      {interactive && active != null && (() => {
        // Portal the bubble to <body> so its frosted glass escapes the GlassCard
        // backdrop context. Map the active point from SVG space to viewport coords.
        const rect = mountRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const sx = w > 0 ? rect.width / w : 1;
        const sy = height > 0 ? rect.height / height : 1;
        const px = rect.left + xAt(active) * sx;
        const py = rect.top + yAt(values[active]) * sy;
        return (
          <ChartTipPortal
            x={px}
            y={py}
            place="above"
            role="status"
            maxWidth={160}
            style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1.3, whiteSpace: "nowrap" }}
          >
            {tooltip!(active, values[active], n)}
          </ChartTipPortal>
        );
      })()}
    </div>
  );
}
