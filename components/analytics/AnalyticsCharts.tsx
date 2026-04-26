"use client";

import {
  BarChart, Bar, Cell, Tooltip, ResponsiveContainer,
  XAxis, CartesianGrid,
} from "recharts";
import type { MonthlyActivityBucket } from "@/lib/services/analytics";

// ── Shared tooltip shell ──────────────────────────────────────────────────────

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.97)",
      border: "1px solid rgba(255,138,101,0.25)",
      borderRadius: 8, padding: "5px 10px", fontSize: 12,
      color: "var(--agent-text-primary)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      {children}
    </div>
  );
}

// ── Volume bar chart (period-sensitive) ───────────────────────────────────────

export type VolumeEntry = { label: string; count: number };

interface VolumeTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function VolumeTooltip({ active, payload, label }: VolumeTooltipProps) {
  if (!active || !payload?.length) return null;
  const n = payload[0].value;
  return (
    <TooltipShell>
      <strong>{n}</strong> {n === 1 ? "file" : "files"} · {label}
    </TooltipShell>
  );
}

export function VolumeBarChart({ data }: { data: VolumeEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        barSize={Math.min(36, Math.max(10, Math.floor(480 / data.length)))}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(180,130,90,0.12)" strokeDasharray="0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--agent-text-muted)" as string }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<VolumeTooltip />}
          cursor={{ fill: "rgba(255,138,101,0.07)", radius: 4 }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill="var(--agent-coral)"
              fillOpacity={entry.count > 0 ? 0.85 : 0.2}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Monthly mix chart (12 months, created vs exchanged) ───────────────────────

interface MixTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function MixTooltip({ active, payload, label }: MixTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipShell>
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: 0, color: p.color }}>
          {p.value} {p.name.toLowerCase()}
        </p>
      ))}
    </TooltipShell>
  );
}

export function MonthlyMixChart({ data }: { data: MonthlyActivityBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        barSize={9}
        barCategoryGap="32%"
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(180,130,90,0.12)" strokeDasharray="0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: "var(--agent-text-muted)" as string }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<MixTooltip />}
          cursor={{ fill: "rgba(255,138,101,0.07)", radius: 4 }}
        />
        <Bar dataKey="created"  name="Created"   fill="#FF8A65" fillOpacity={0.80} radius={[2, 2, 0, 0]} />
        <Bar dataKey="exchanged" name="Exchanged" fill="#C97D1A" fillOpacity={0.90} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
