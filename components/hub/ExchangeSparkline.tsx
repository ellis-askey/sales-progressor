"use client";

// 8-week exchange trend for the Hub pipeline-health strip. Draws to REAL pixels
// (measured via ResizeObserver, SVG width = measured px with a matching viewBox)
// so the line never stretches or flattens on a wide card — the same approach as
// ForecastView's confidence curve. Hover reads each week; on touch, press-and-
// drag scrubs week to week with a light haptic tick (silent on iOS, which has no
// vibrate API). Parent stays a server component and just hands us the series.

import { useCallback, useEffect, useRef, useState } from "react";

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
      {active != null && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: Math.max(46, Math.min(w - 46, xAt(active))),
            top: yAt(weeks[active]) - 10,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            background: "#1c1917",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 9,
            padding: "5px 9px",
            fontSize: 11,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 20px -8px rgba(0,0,0,0.55)",
            zIndex: 3,
          }}
        >
          <strong style={{ fontWeight: 700 }}>{weekLabel(active)}</strong>
          <br />
          <span style={{ color: "#ff9078" }}>{weeks[active]}</span> exchange
          {weeks[active] === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
