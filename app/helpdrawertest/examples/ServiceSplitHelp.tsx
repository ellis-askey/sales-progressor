"use client";

import { ServiceSplitDonut } from "@/components/hub/HubCharts";

export function ServiceSplitHelpExample(_props: Record<string, string>) {
  const selfManaged = 8;
  const outsourced = 4;
  const total = selfManaged + outsourced;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <ServiceSplitDonut selfManaged={selfManaged} outsourced={outsourced} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--agent-text-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-coral)", display: "inline-block" }} />
            Self-managed
          </span>
          <span style={{ color: "var(--agent-text-primary)", fontWeight: 500 }}>
            {selfManaged} &nbsp;·&nbsp; {Math.round((selfManaged / total) * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--agent-text-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-warning)", display: "inline-block" }} />
            With progressor
          </span>
          <span style={{ color: "var(--agent-text-primary)", fontWeight: 500 }}>
            {outsourced} &nbsp;·&nbsp; {Math.round((outsourced / total) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
