"use client";

import { calculateRiskScore, RISK_CONFIG, type RiskInput } from "@/lib/services/risk";
import { GlassCard } from "@/components/glass/GlassCard";

const BAR_COLOR: Record<string, string> = {
  high:    "#ef4444",
  medium:  "#f59e0b",
  low:     "var(--agent-success)",
  no_data: "rgba(30,45,74,.08)",
};

export function RiskScoreWidget({ input }: { input: RiskInput }) {
  const { level, score } = calculateRiskScore(input);
  const cfg = RISK_CONFIG[level];

  return (
    // Design Lab: `overview-risk`. Default v05 (final pick set 2026-08-08).
    <GlassCard glassId="overview-risk" label="Overview · Fall-through risk" defaultVariant="v05" id="risk-score" className="overflow-hidden" style={{ scrollMarginTop: 100, borderRadius: 12 }}>
      <div className="agent-card-hdr">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Fall-through risk</h3>
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Risk score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            {level === "no_data" ? "— / 100" : `${score} / 100`}
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(30,45,74,.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${Math.max(score, level === "no_data" ? 0 : 3)}%`,
            height: "100%",
            background: BAR_COLOR[level] ?? BAR_COLOR.low,
            borderRadius: 3,
            transition: "width 700ms ease-out",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>Low</span>
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>High</span>
        </div>
        {level === "no_data" ? (
          <p style={{ fontSize: 11, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 8 }}>
            Risk factors will appear as the file progresses.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 8, marginBottom: 0 }}>{cfg.label}</p>
            <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2, marginBottom: 0 }}>
              {level === "low"
                ? "No significant risk factors on this file"
                : "This file has chases or activity gaps that need attention, separate from how steps are progressing"}
            </p>
          </>
        )}
      </div>
    </GlassCard>
  );
}
