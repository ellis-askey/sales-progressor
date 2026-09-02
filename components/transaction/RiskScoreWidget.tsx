"use client";

import { calculateRiskScore, RISK_CONFIG, RISK_POINTS, type RiskInput } from "@/lib/services/risk";
import { GlassCard } from "@/components/glass/GlassCard";

// Impact → colour, shared by the score number, the contribution bar and the
// per-factor dots so a high-impact factor reads red, medium amber, low a
// quieter bronze. Distinct low tone keeps a 10-pt segment legible next to a 20.
const IMPACT_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#c98a2b",
};

// Band → the headline score colour.
const BAND_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "var(--agent-success)",
  no_data: "var(--agent-text-muted)",
};

export function RiskScoreWidget({ input }: { input: RiskInput }) {
  const { level, score, factors } = calculateRiskScore(input);
  const cfg = RISK_CONFIG[level];
  const triggered = factors.filter((f) => f.triggered);
  const cleared = factors.filter((f) => !f.triggered);
  // Both "on hold" and a brand-new empty file score as no_data; only the file's
  // own onTrack state tells them apart, so we read it straight from the input.
  const onHold = input.onTrack === "on_hold";

  return (
    // Design Lab: `overview-risk`. Default v05 (final pick set 2026-08-08).
    <GlassCard glassId="overview-risk" label="Overview · Fall-through risk" defaultVariant="v05" id="risk-score" className="overflow-hidden" style={{ scrollMarginTop: 100, borderRadius: 12 }}>
      <div className="agent-card-hdr" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Fall-through risk</h3>
        {level !== "no_data" && (
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: BAND_COLOR[level], fontVariantNumeric: "tabular-nums" }}>{score}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>/100</span>
          </span>
        )}
      </div>

      <div style={{ padding: "14px 16px" }}>
        {level === "no_data" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Risk score</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>–/100</span>
            </div>
            <div style={{ height: 6, background: "rgba(30,45,74,.08)", borderRadius: 3 }} />
            <p style={{ fontSize: 11, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 10, marginBottom: 0 }}>
              {onHold
                ? "This file is on hold. Risk tracking is paused until it resumes."
                : "Risk factors will appear as the file progresses."}
            </p>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                How the score builds
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: BAND_COLOR[level] }}>{cfg.label}</span>
            </div>

            {triggered.length === 0 ? (
              <>
                <div style={{ height: 30, borderRadius: 8, background: "rgba(52,211,153,0.12)", border: "0.5px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-success)" }}>Nothing adding to the score right now</span>
                </div>
                <p style={{ fontSize: 10.5, color: "var(--agent-text-muted)", marginTop: 8, marginBottom: 0 }}>
                  Chases and activity gaps show here as points if they appear.
                </p>
              </>
            ) : (
              <>
                {/* Contribution bar — each triggered factor sized by its share of the score. */}
                <div style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden", border: "0.5px solid var(--agent-border-default)" }}>
                  {triggered.map((f) => {
                    const pts = RISK_POINTS[f.impact];
                    const pct = score > 0 ? (pts / score) * 100 : 0;
                    return (
                      <span
                        key={f.label}
                        title={`${f.label} · +${pts}`}
                        style={{
                          width: `${pct}%`, height: "100%", background: IMPACT_COLOR[f.impact],
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10.5, fontWeight: 700, color: "#0a0e1a",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {pct >= 14 ? pts : ""}
                      </span>
                    );
                  })}
                </div>

                {/* Per-factor breakdown — every point is attributable. */}
                <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 9 }}>
                  {triggered.map((f) => (
                    <li key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, marginTop: 5, flexShrink: 0, background: IMPACT_COLOR[f.impact] }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>{f.label}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: IMPACT_COLOR[f.impact], flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>+{RISK_POINTS[f.impact]}</span>
                        </span>
                        <span style={{ display: "block", fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.35, marginTop: 1 }}>{f.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Cleared factors — what's NOT dragging the file, for reassurance. */}
                {cleared.length > 0 && (
                  <>
                    <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", margin: "12px 0 0" }} />
                    <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
                      {cleared.map((f) => (
                        <li key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--agent-text-muted)" }}>
                          <span>{f.label}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>clear</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
}
