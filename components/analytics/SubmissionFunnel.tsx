import type { SubmissionFunnelData } from "@/lib/services/analytics";

const STAGE_COLORS = {
  submitted: { bar: "#FF8A65", dot: "#FF8A65", text: "var(--agent-coral)" },
  exchanged:  { bar: "#C97D1A", dot: "#C97D1A", text: "var(--agent-warning)" },
  completed:  { bar: "#16A34A", dot: "#16A34A", text: "var(--agent-success)" },
} as const;

export function SubmissionFunnel({ data }: { data: SubmissionFunnelData }) {
  const max = data.stages[0]?.count ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {data.stages.map((stage, i) => {
        const colors  = STAGE_COLORS[stage.key as keyof typeof STAGE_COLORS];
        const widthPct = max > 0 ? Math.max(4, Math.round((stage.count / max) * 100)) : 4;
        const conv     = data.conversions.find((c) => c.from === stage.key);

        return (
          <div key={stage.key}>
            {/* Stage row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Label */}
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: "var(--agent-text-secondary)",
                width: 68, flexShrink: 0,
              }}>
                {stage.label}
              </span>

              {/* Bar */}
              <div style={{ flex: 1, height: 10, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: `${widthPct}%`,
                  background: colors.bar,
                  opacity: 0.85,
                  transition: "width 0.3s ease",
                }} />
              </div>

              {/* Count */}
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: "var(--agent-text-primary)",
                width: 28, textAlign: "right", flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}>
                {stage.count}
              </span>
            </div>

            {/* Conversion arrow between stages */}
            {conv && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: 78, margin: "3px 0",
              }}>
                <span style={{ fontSize: 10, color: "var(--agent-text-muted)", lineHeight: 1 }}>↓</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: conv.percent >= 50 ? "var(--agent-success)" : "var(--agent-warning)",
                  background: conv.percent >= 50 ? "var(--agent-success-bg)" : "var(--agent-warning-bg)",
                  padding: "1px 6px", borderRadius: 99,
                }}>
                  {conv.percent}%
                </span>
                <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                  converted
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
