"use client";

import { calculateRiskScore, RISK_CONFIG, type RiskInput } from "@/lib/services/risk";
import { GlassCard } from "@/components/glass/GlassCard";

const BAR_COLOR: Record<string, string> = {
  high:    "#ef4444",
  medium:  "#f59e0b",
  low:     "var(--agent-success)",
  no_data: "rgba(30,45,74,.08)",
};

// Impact → dot colour for the factor list. Mirrors the bar/band palette so a
// high-impact factor reads red, medium amber, low a quiet slate.
const IMPACT_DOT: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "rgba(30,45,74,.35)",
};

export function RiskScoreWidget({ input }: { input: RiskInput }) {
  const { level, score, factors } = calculateRiskScore(input);
  const cfg = RISK_CONFIG[level];
  const triggered = factors.filter((f) => f.triggered);
  // Both "on hold" and a brand-new empty file score as no_data; only the file's
  // own onTrack state tells them apart, so we read it straight from the input.
  const onHold = input.onTrack === "on_hold";

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
            {level === "no_data" ? "–/100" : `${score} / 100`}
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
            {onHold
              ? "This file is on hold. Risk tracking is paused until it resumes."
              : "Risk factors will appear as the file progresses."}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 8, marginBottom: 0 }}>{cfg.label}</p>
            {triggered.length === 0 ? (
              <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2, marginBottom: 0 }}>
                Nothing on this file needs attention right now.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2, marginBottom: 0 }}>
                  Chases or activity gaps to look at, separate from how the steps are progressing.
                </p>
                <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
                  {triggered.map((f) => (
                    <li key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span aria-hidden style={{
                        width: 6, height: 6, borderRadius: 999, marginTop: 5, flexShrink: 0,
                        background: IMPACT_DOT[f.impact] ?? IMPACT_DOT.low,
                      }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>
                          {f.label}
                        </span>
                        <span style={{ display: "block", fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.35, marginTop: 1 }}>
                          {f.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
}
