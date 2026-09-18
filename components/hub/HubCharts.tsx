"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { PieChart, Pie, Cell } from "recharts";
import type { WeekBucket } from "@/lib/services/hub";
import { fmtCurrencyPence } from "@/lib/utils";
import { useIsDarkTheme } from "./PipelineStageHover";

// ── Refresh button ─────────────────────────────────────────────────────────────

export function RefreshButton({ updatedLabel }: { updatedLabel: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      title="Refresh data"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "none", border: "none", cursor: "pointer",
        color: "var(--agent-text-muted)", fontSize: 11,
        padding: "4px 8px", borderRadius: 6, transition: "background 150ms",
      }}
      className="hover:bg-black/[0.04]"
    >
      <ArrowsClockwise size={13} />
      {updatedLabel}
    </button>
  );
}

// ── Momentum ring ─────────────────────────────────────────────────────────────

export function MomentumRing({ percent }: { percent: number | null }) {
  const r = 32; const cx = 40; const cy = 40;
  const circ = 2 * Math.PI * r;
  const progress = percent !== null ? Math.min(100, Math.max(0, percent)) / 100 : 0;
  const target = circ * (1 - progress);
  const [rm, setRm] = useState(false);
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    if (percent === null) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setRm(true); setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (percent === null) {
    return (
      <div style={{ textAlign: "center", maxWidth: 160, padding: "4px 0" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          No comparison yet
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Check back after your first full month.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={80} height={80} viewBox="0 0 80 80" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(var(--agent-coral-base-rgb),0.18)" strokeWidth={7} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--agent-coral)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: rm ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text
          x={cx} y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 15, fontWeight: 600, fill: "var(--agent-text-primary)", fontFamily: "inherit" }}
        >
          {percent}%
        </text>
      </svg>
    </div>
  );
}

// ── Exchange forecast heat band ───────────────────────────────────────────────
// F6 glass band (Ellis pick, 2026-09-18) — replaced the recharts bar chart +
// house glyphs. Five glass cells, coral intensity scaled to the week's count,
// count + week label printed IN the cell (so no hover needed for the number).
// The hover popup keeps the frosty-glass recipe (same family as
// PipelineStageHover) but now shows what the chart can't: the properties due
// that week (biggest first) and their combined value.

// Popup week phrase: "this week", "+1 week", "+4 weeks" (never the cell's
// terse "+4w" — Ellis, 2026-09-18).
function weekPhrase(w: WeekBucket): string {
  if (w.isCurrentWeek) return "this week";
  const n = parseInt(w.label.replace(/\D/g, ""), 10) || 0;
  return n === 1 ? "+1 week" : `+${n} weeks`;
}

export function ForecastHeatBand({ data }: { data: WeekBucket[] }) {
  const isDark = useIsDarkTheme();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 0);
  const open = openIdx !== null ? data[openIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, height: 56, marginTop: 4 }}>
        {data.map((w, i) => {
          const t = max > 0 ? w.count / max : 0;
          const zero = w.count === 0;
          const solid = !zero && t === 1; // the busiest week gets the full glass gradient
          const cellBg = zero
            ? "var(--agent-hover-shade)"
            : solid
              ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))"
              : `linear-gradient(180deg, rgba(var(--agent-coral-base-rgb), ${(0.12 + 0.3 * t).toFixed(2)}), rgba(var(--agent-coral-base-rgb), ${(0.2 + 0.38 * t).toFixed(2)}))`;
          const numColor = zero ? "var(--agent-text-muted)" : solid ? "#fff" : "var(--agent-coral-deep)";
          const labelColor = solid
            ? "rgba(255,255,255,0.85)"
            : w.isCurrentWeek
              ? "var(--agent-coral-deep)"
              : "var(--agent-text-muted)";
          const highlight = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)";
          return (
            <button
              key={w.label}
              type="button"
              aria-label={`${w.label}: ${w.count} ${w.count === 1 ? "exchange" : "exchanges"} due${w.feesPence > 0 ? `, ${fmtCurrencyPence(w.feesPence)} in fees` : ""}`}
              onMouseEnter={() => !zero && setOpenIdx(i)}
              onMouseLeave={() => setOpenIdx((cur) => (cur === i ? null : cur))}
              onFocus={() => !zero && setOpenIdx(i)}
              onBlur={() => setOpenIdx((cur) => (cur === i ? null : cur))}
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
                {w.count}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: w.isCurrentWeek ? 700 : 600, textTransform: "uppercase", letterSpacing: "0.05em", color: labelColor }}>
                {w.label}
              </span>
            </button>
          );
        })}
      </div>

      {open && openIdx !== null && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            ...(openIdx === 0
              ? { left: 0 }
              : openIdx === data.length - 1
                ? { right: 0 }
                : { left: `${((openIdx + 0.5) * 100) / data.length}%`, transform: "translateX(-50%)" }),
            zIndex: 20, width: "max-content", maxWidth: 250, pointerEvents: "none",
            background: isDark ? "rgba(20, 28, 44, 0.72)" : "rgba(255, 255, 255, 0.85)",
            border: isDark ? "0.5px solid rgba(255,255,255,0.14)" : "0.5px solid rgba(15,23,42,0.08)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            borderRadius: 10, padding: "8px 12px",
            color: isDark ? "#EFF6FF" : "#1e293b",
            boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.40)" : "0 12px 32px rgba(15,23,42,0.14)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
            {open.feesPence > 0
              ? `${fmtCurrencyPence(open.feesPence)} in fees due ${weekPhrase(open)}`
              : `${open.count} ${open.count === 1 ? "exchange" : "exchanges"} ${weekPhrase(open)}`}
          </p>
          {open.files.slice(0, 3).map((f) => (
            <p key={f.address} style={{ margin: "4px 0 0", fontSize: 11.5, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.address}
              {f.feePence > 0 && ` · ${fmtCurrencyPence(f.feePence)}`}
            </p>
          ))}
          {open.files.length > 3 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.6 }}>
              +{open.files.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Service split donut ───────────────────────────────────────────────────────

export function ServiceSplitDonut({
  selfManaged,
  outsourced,
}: {
  selfManaged: number;
  outsourced: number;
}) {
  const hasData = selfManaged > 0 || outsourced > 0;

  const chartData = hasData
    ? [
        { name: "Self-progressed", value: selfManaged,  color: "var(--agent-coral)"   },
        { name: "With us",         value: outsourced,   color: "var(--agent-warning)" },
      ].filter((d) => d.value > 0)
    : [{ name: "Empty", value: 1, color: "rgba(var(--agent-shadow-rgb),0.09)" }];

  return (
    <PieChart width={92} height={92}>
      <Pie
        data={chartData}
        cx={46}
        cy={46}
        innerRadius={28}
        outerRadius={38}
        dataKey="value"
        strokeWidth={0}
        startAngle={90}
        endAngle={-270}
      >
        {chartData.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
    </PieChart>
  );
}
