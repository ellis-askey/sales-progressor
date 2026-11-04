"use client";

// 8-week exchange trend for the Hub pipeline-health strip. Draws to REAL pixels
// (measured via ResizeObserver, SVG width = measured px with a matching viewBox)
// so the line never stretches or flattens on a wide card — the same approach as
// ForecastView's confidence curve. Hover reads each week; on touch, press-and-
// drag scrubs week to week with a light haptic tick (silent on iOS, which has no
// vibrate API). Parent stays a server component and just hands us the series.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartTipPortal } from "@/components/agent/ChartTipPortal";

export function ExchangeSparkline({
  weeks,
  height = 44,
}: {
  weeks: number[];
  height?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(240);
  const [active, setActive] = useState<number | null>(null);
  const lastActive = useRef<number | null>(null);

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

  const n = weeks.length;
  const max = Math.max(1, ...weeks);
  const padL = 5, padR = 5, padT = 9, padB = 8;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = height - padT - padB;
  const xAt = (i: number) => padL + (n < 2 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;
  const pts = weeks.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

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

  const weekLabel = (i: number) =>
    i === n - 1 ? "This week" : i === n - 2 ? "Last week" : `${n - 1 - i} weeks ago`;

  return (
    <div
      ref={mountRef}
      style={{
        position: "relative",
        width: "100%",
        touchAction: "none",
        cursor: "crosshair",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerLeave={clear}
      onPointerCancel={clear}
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
          stroke="var(--agent-coral)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xAt(n - 1)} cy={yAt(weeks[n - 1])} r={3} fill="var(--agent-coral)" />
        {active != null && (
          <>
            <circle cx={xAt(active)} cy={yAt(weeks[active])} r={7} fill="var(--agent-coral)" opacity={0.18} />
            <circle cx={xAt(active)} cy={yAt(weeks[active])} r={4} fill="var(--agent-coral)" />
          </>
        )}
      </svg>
      {active != null && (() => {
        // Portal the bubble to <body> so its frosted glass escapes the
        // GlassCard backdrop context (which flattened it to see-through). Map
        // the active point from SVG space to viewport coordinates.
        const rect = mountRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const sx = w > 0 ? rect.width / w : 1;
        const sy = height > 0 ? rect.height / height : 1;
        const px = rect.left + xAt(active) * sx;
        const py = rect.top + yAt(weeks[active]) * sy;
        return (
          <ChartTipPortal
            x={px}
            y={py}
            place="above"
            role="status"
            maxWidth={160}
            style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1.3, whiteSpace: "nowrap" }}
          >
            <strong style={{ fontWeight: 700 }}>{weekLabel(active)}</strong>
            <br />
            <span style={{ color: "var(--agent-coral-deep)" }}>{weeks[active]}</span> exchange
            {weeks[active] === 1 ? "" : "s"}
          </ChartTipPortal>
        );
      })()}
    </div>
  );
}
