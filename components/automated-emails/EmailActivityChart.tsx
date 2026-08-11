"use client";

// Compact per-day stacked bar chart: chase (coral) + notification (blue), the
// two automated-email categories. Deliberately visually secondary to the KPI
// numbers above it — short, muted axes, no gridlines. Built on recharts (the
// repo's charting standard); stacked via a shared stackId (no existing chart
// stacks, so this is the first — catalogued in the folder README per Law 14).

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import type { DayBucket } from "@/lib/services/automated-emails-overview";

const CHASE = "var(--agent-coral)";
const NOTIF = "var(--agent-info)";

type TooltipEntry = { name: string; value: number; color: string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div
      style={{
        background: "var(--agent-surface-raised, #fff)",
        border: "1px solid var(--agent-border-default)",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "var(--agent-shadow-md, 0 4px 16px rgba(0,0,0,0.12))",
        fontSize: 12,
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "2px 0 0", color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block" }} />
          {p.name}: <strong style={{ color: "var(--agent-text-primary)" }}>{p.value}</strong>
        </p>
      ))}
      <p style={{ margin: "4px 0 0", color: "var(--agent-text-muted)" }}>Total {total}</p>
    </div>
  );
}

export function EmailActivityChart({ data }: { data: DayBucket[] }) {
  // Show at most ~10 x-axis labels so a 30/90-day range stays legible.
  const interval = Math.max(0, Math.ceil(data.length / 10) - 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <LegendKey color={CHASE} label="Chase" />
        <LegendKey color={NOTIF} label="Notification" />
      </div>
      <div style={{ width: "100%", height: 140 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="18%">
            <XAxis
              dataKey="label"
              interval={interval}
              tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }}
              axisLine={{ stroke: "var(--agent-border-subtle, #e5e5e5)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 10, fill: "var(--agent-text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: "var(--agent-surface-nested, rgba(0,0,0,0.04))" }} content={<ChartTooltip />} />
            <Bar dataKey="chase" name="Chase" stackId="a" fill={CHASE} radius={[0, 0, 0, 0]} />
            <Bar dataKey="notification" name="Notification" stackId="a" fill={NOTIF} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--agent-text-secondary)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
