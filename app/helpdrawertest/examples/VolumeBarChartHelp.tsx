"use client";

import { VolumeBarChart } from "@/components/analytics/AnalyticsCharts";
import type { VolumeEntry } from "@/components/analytics/AnalyticsCharts";

const MOCK_DATA: VolumeEntry[] = [
  { label: "Dec 24", count: 3 },
  { label: "Jan 25", count: 5 },
  { label: "Feb 25", count: 4 },
  { label: "Mar 25", count: 7 },
  { label: "Apr 25", count: 6 },
  { label: "May 25", count: 4 },
];

export function VolumeBarChartHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ padding: "16px 20px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Files submitted — last 6 months
      </p>
      <VolumeBarChart data={MOCK_DATA} />
    </div>
  );
}
