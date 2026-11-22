"use client";

// Compact per-day stacked bar chart: chase (coral) + notification (blue), the
// two automated-email categories. Deliberately visually secondary to the KPI
// numbers above it — short, muted axes, no gridlines. Built on recharts (the
// repo's charting standard); catalogued in the design-system gallery under
// Progress indicators (the time-series stacked bar). Its hover tooltip renders
// through the canonical ChartTipPortal so the frosted bubble escapes the
// GlassCard backdrop and reads crisp (see ChartTipPortal).

import { useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { LegendItem } from "@/components/ui/LegendItem";
import { ChartTipPortal } from "@/components/agent/ChartTipPortal";
import type { DayBucket } from "@/lib/services/automated-emails-overview";

const CHASE = "var(--agent-coral)";
const NOTIF = "var(--agent-info)";

type TooltipEntry = { name: string; value: number; color: string };

// recharts injects active / payload / label / coordinate (chart-relative). We
// add the chart wrapper's viewport rect and render the bubble via ChartTipPortal
// (on <body>), so the backdrop-blur samples the page, not the flat glass card.
function ChartTooltip({
  active,
  payload,
  label,
  coordinate,
  rectRef,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  coordinate?: { x?: number; y?: number };
  rectRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rect = rectRef.current?.getBoundingClientRect();
  if (!rect || !coordinate || coordinate.x == null || coordinate.y == null) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <ChartTipPortal x={rect.left + coordinate.x} y={rect.top + coordinate.y} className="ui-chart-tip" maxWidth={200} style={{ padding: "8px 11px", fontSize: 12 }}>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "2px 0 0", color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block" }} />
          {p.name}: <strong style={{ color: "var(--agent-text-primary)" }}>{p.value}</strong>
        </p>
      ))}
      <p style={{ margin: "4px 0 0", color: "var(--agent-text-muted)" }}>Total {total}</p>
    </ChartTipPortal>
  );
}

export function EmailActivityChart({ data }: { data: DayBucket[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Show at most ~10 x-axis labels so a 30/90-day range stays legible.
  const interval = Math.max(0, Math.ceil(data.length / 10) - 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <LegendItem color={CHASE} label="Chase" />
        <LegendItem color={NOTIF} label="Notification" />
      </div>
      <div ref={wrapRef} style={{ width: "100%", height: 140 }} aria-hidden="true">
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
            <Tooltip cursor={{ fill: "var(--agent-surface-nested, rgba(0,0,0,0.04))" }} content={<ChartTooltip rectRef={wrapRef} />} />
            <Bar dataKey="chase" name="Chase" stackId="a" fill={CHASE} radius={[0, 0, 0, 0]} />
            <Bar dataKey="notification" name="Notification" stackId="a" fill={NOTIF} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
