"use client";

import { SpeedGauge } from "@/components/analytics/SpeedGauge";

export function SpeedGaugeHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ padding: "16px 20px" }}>
      <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>
        82 days
      </p>
      <p style={{ margin: "0 0 8px", fontSize: 10, color: "var(--agent-text-muted)" }}>
        avg from instruction · 18 files exchanged
      </p>
      <span style={{
        display: "inline-block", fontSize: 11, fontWeight: 600,
        padding: "3px 10px", borderRadius: 99,
        color: "var(--agent-warning)",
        background: "var(--agent-warning-bg)",
        border: "1px solid var(--agent-warning-border)",
        marginBottom: 4,
      }}>
        Typical
      </span>
      <SpeedGauge avgDays={82} />
    </div>
  );
}
