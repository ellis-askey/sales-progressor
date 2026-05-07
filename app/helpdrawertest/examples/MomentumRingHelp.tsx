"use client";

import { MomentumRing } from "@/components/hub/HubCharts";

export function MomentumRingHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0" }}>
      <MomentumRing percent={130} />
      <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>
        This month: 13 exchanges &nbsp;·&nbsp; Last month: 10 exchanges
      </p>
    </div>
  );
}
