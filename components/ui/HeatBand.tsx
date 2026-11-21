"use client";

// Canonical heat band — a row of glass cells whose coral intensity scales to each cell's
// value, with the number + label printed in-cell and an optional hover popup. Extracted
// 2026-11-21 from the hub's ForecastHeatBand (the exchange-forecast strip), generalised:
// pass `cells` (label + value, `strong` for the "now" accent) and an optional `tooltip`
// slot for the per-cell popup content. Same pixels as the shipped band.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChartTipPortal } from "@/components/agent/ChartTipPortal";

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export interface HeatCell {
  label: string;
  value: number;
  /** The accented cell (e.g. "this week") — tints the label coral + bolds it. */
  strong?: boolean;
  ariaLabel?: string;
}

export function HeatBand({
  cells,
  tooltip,
  height = 56,
}: {
  cells: HeatCell[];
  /** Popup content for a hovered (non-zero) cell. Omit → no hover popup. */
  tooltip?: (index: number) => ReactNode;
  height?: number;
}) {
  const isDark = useIsDark();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const max = Math.max(...cells.map((c) => c.value), 0);
  const interactiveTip = typeof tooltip === "function";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, height, marginTop: 4 }}>
        {cells.map((w, i) => {
          const t = max > 0 ? w.value / max : 0;
          const zero = w.value === 0;
          const solid = !zero && t === 1;
          const cellBg = zero
            ? "var(--agent-hover-shade)"
            : solid
              ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))"
              : `linear-gradient(180deg, rgba(var(--agent-coral-base-rgb), ${(0.12 + 0.3 * t).toFixed(2)}), rgba(var(--agent-coral-base-rgb), ${(0.2 + 0.38 * t).toFixed(2)}))`;
          const numColor = zero ? "var(--agent-text-muted)" : solid ? "#fff" : "var(--agent-coral-deep)";
          const labelColor = solid
            ? "rgba(255,255,255,0.85)"
            : w.strong
              ? "var(--agent-coral-deep)"
              : "var(--agent-text-muted)";
          const highlight = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)";
          const canHover = !zero && interactiveTip;
          return (
            <button
              key={w.label}
              type="button"
              aria-label={w.ariaLabel}
              onMouseEnter={canHover ? (e) => { setOpenIdx(i); setAnchor(e.currentTarget.getBoundingClientRect()); } : undefined}
              onMouseLeave={canHover ? () => setOpenIdx((cur) => (cur === i ? null : cur)) : undefined}
              onFocus={canHover ? (e) => { setOpenIdx(i); setAnchor(e.currentTarget.getBoundingClientRect()); } : undefined}
              onBlur={canHover ? () => setOpenIdx((cur) => (cur === i ? null : cur)) : undefined}
              style={{
                flex: 1, minWidth: 0, borderRadius: 10, padding: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                background: cellBg,
                border: zero ? "0.5px solid transparent" : `0.5px solid ${highlight}`,
                boxShadow: zero
                  ? "none"
                  : `inset 0 1px 0 ${highlight}, 0 5px 12px rgba(var(--agent-coral-base-rgb), ${(0.08 + 0.16 * t).toFixed(2)})`,
                cursor: zero ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "filter 150ms ease",
                filter: openIdx === i ? "brightness(0.96)" : "none",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                {w.value}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: w.strong ? 700 : 600, textTransform: "uppercase", letterSpacing: "0.05em", color: labelColor }}>
                {w.label}
              </span>
            </button>
          );
        })}
      </div>

      {interactiveTip && openIdx !== null && anchor && (
        <ChartTipPortal
          x={anchor.left + anchor.width / 2}
          y={anchor.top}
          place="above"
          maxWidth={250}
          style={{ padding: "8px 12px" }}
        >
          {tooltip!(openIdx)}
        </ChartTipPortal>
      )}
    </div>
  );
}
