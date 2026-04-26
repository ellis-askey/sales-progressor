"use client";

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
  if (percent === null) {
    return (
      <div style={{ textAlign: "center", maxWidth: 160, padding: "4px 0" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          No comparison yet
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Compares exchanges month over month. Data appears after your first completed month.
        </p>
      </div>
    );
  }

  const r = 32;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(100, Math.max(0, percent)) / 100;
  const offset = circ * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={80} height={80} viewBox="0 0 80 80" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,138,101,0.18)" strokeWidth={7} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--agent-coral)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
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
      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0, textAlign: "center" }}>
        vs last month
      </p>
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
      background: "rgba(255,255,255,0.97)",
      border: "1px solid rgba(255,138,101,0.25)",
      borderRadius: 8, padding: "5px 10px", fontSize: 12,
      color: "var(--agent-text-primary)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
          cursor={{ fill: "rgba(255,138,101,0.07)", radius: 4 }}
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
        { name: "Self-progressed", value: selfManaged,  color: "#FF8A65" },
        { name: "With us",         value: outsourced,   color: "#C97D1A" },
      ].filter((d) => d.value > 0)
    : [{ name: "Empty", value: 1, color: "rgba(45,24,16,0.09)" }];

  return (
    <PieChart width={84} height={84}>
      <Pie
        data={chartData}
        cx={42}
        cy={42}
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
