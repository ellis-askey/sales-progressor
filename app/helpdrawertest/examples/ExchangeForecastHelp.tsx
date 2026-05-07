"use client";

import { ExchangeForecastChart } from "@/components/hub/HubCharts";

const FORECAST = [
  { label: "This wk", count: 2, isCurrentWeek: true },
  { label: "+1w",     count: 4, isCurrentWeek: false },
  { label: "+2w",     count: 1, isCurrentWeek: false },
  { label: "+3w",     count: 3, isCurrentWeek: false },
  { label: "+4w",     count: 1, isCurrentWeek: false },
];

export function ExchangeForecastHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ padding: "8px 0" }}>
      <ExchangeForecastChart data={FORECAST} />
      <div style={{
        display: "flex", gap: 16, marginTop: 10,
        fontSize: 11, color: "var(--agent-text-muted)",
      }}>
        <span>This week: <strong style={{ color: "var(--agent-coral)" }}>2 exchanges</strong></span>
        <span>Next 30 days: <strong>11 exchanges</strong></span>
      </div>
    </div>
  );
}
