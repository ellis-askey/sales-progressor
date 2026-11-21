"use client";

// 8-week exchange trend for the Hub pipeline-health strip. A thin wrapper over the canonical
// Sparkline (components/ui/Sparkline.tsx) — it only supplies the exchange-specific scrub
// tooltip copy; the chart itself (measured pixels, coral line + endpoint, hover/touch scrub)
// is the shared primitive.

import { Sparkline } from "@/components/ui/Sparkline";

export function ExchangeSparkline({
  weeks,
  height = 44,
}: {
  weeks: number[];
  height?: number;
}) {
  return (
    <Sparkline
      values={weeks}
      height={height}
      tooltip={(i, value, n) => {
        const label = i === n - 1 ? "This week" : i === n - 2 ? "Last week" : `${n - 1 - i} weeks ago`;
        return (
          <>
            <strong style={{ fontWeight: 700 }}>{label}</strong>
            <br />
            <span style={{ color: "var(--agent-coral-deep)" }}>{value}</span> exchange{value === 1 ? "" : "s"}
          </>
        );
      }}
    />
  );
}
