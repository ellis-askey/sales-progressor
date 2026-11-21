"use client";

// Canonical donut / ring chart. Extracted 2026-11-21 from the hub's ServiceSplitDonut
// (the "who's managing" split) and generalised: pass `segments` (value + colour). recharts
// stays the engine; this just gives every donut in the app one component + sizing. An
// all-zero series renders a single faint ring so the slot never collapses.

import { PieChart, Pie, Cell } from "recharts";

export function Donut({
  segments,
  size = 92,
  thickness = 10,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  /** Ring thickness in px (outer − inner). */
  thickness?: number;
}) {
  const c = size / 2;
  const outer = c - 8;
  const inner = outer - thickness;
  const hasData = segments.some((s) => s.value > 0);
  const data = hasData
    ? segments.filter((s) => s.value > 0)
    : [{ value: 1, color: "rgba(var(--agent-shadow-rgb),0.09)" }];

  return (
    <PieChart width={size} height={size}>
      <Pie
        data={data}
        cx={c}
        cy={c}
        innerRadius={inner}
        outerRadius={outer}
        dataKey="value"
        strokeWidth={0}
        startAngle={90}
        endAngle={-270}
      >
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
    </PieChart>
  );
}
