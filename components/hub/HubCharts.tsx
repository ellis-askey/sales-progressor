"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@phosphor-icons/react";
import {
  BarChart, Bar, Cell, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from "recharts";
import type { WeekBucket } from "@/lib/services/hub";

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

// ── Exchange forecast bar chart ───────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeekBucket }>;
}

function ForecastTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div style={{
      background: "rgba(255,255,255,0.88)",
      border: "0.5px solid var(--agent-glass-border)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRadius: 8, padding: "5px 10px", fontSize: 12,
      color: "var(--agent-text-primary)",
    }}>
      <strong>{count}</strong>{" "}
      {count === 1 ? "exchange" : "exchanges"} · {label}
    </div>
  );
}

export function ExchangeForecastChart({ data }: { data: WeekBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={60}>
      <BarChart data={data} barSize={14} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
        <Tooltip
          content={<ForecastTooltip />}
          cursor={{ fill: "rgba(var(--agent-coral-base-rgb),0.07)", radius: 4 }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill="var(--agent-coral)"
              fillOpacity={
                entry.isCurrentWeek
                  ? 1
                  : Math.max(0.35, 0.75 - i * 0.08)
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
