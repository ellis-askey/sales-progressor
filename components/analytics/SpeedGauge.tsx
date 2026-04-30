// Scale: 0–130 days. Fast < 70, Typical 70–100, Slow > 100.
const SCALE_MAX  = 130;
const FAST_PCT   = (70  / SCALE_MAX) * 100; // 53.8%
const TYPICAL_PCT = (100 / SCALE_MAX) * 100; // 76.9%

interface SpeedGaugeProps {
  avgDays: number;
}

export function SpeedGauge({ avgDays }: SpeedGaugeProps) {
  const markerPct = Math.min(96, Math.max(2, (avgDays / SCALE_MAX) * 100));

  const markerColor =
    avgDays <= 70  ? "var(--agent-success)" :
    avgDays <= 100 ? "var(--agent-warning)" :
                     "var(--agent-danger)";

  return (
    <div style={{ marginTop: 14 }}>
      {/* Track */}
      <div style={{
        position: "relative",
        height: 7,
        borderRadius: 99,
        background: `linear-gradient(to right,
          #16A34A 0%,
          #16A34A ${FAST_PCT - 1}%,
          #C97D1A ${FAST_PCT + 1}%,
          #C97D1A ${TYPICAL_PCT - 1}%,
          #D94F4F ${TYPICAL_PCT + 1}%,
          #D94F4F 100%
        )`,
        opacity: 0.75,
      }}>
        {/* Marker */}
        <div style={{
          position: "absolute",
          left: `${markerPct}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: "#fff",
          border: `2.5px solid ${markerColor}`,
          boxShadow: "0 1px 5px rgba(0,0,0,0.18)",
        }} />
      </div>

      {/* Labels */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 5,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}>
        <span style={{ color: "var(--agent-success)" }}>Fast &lt;70d</span>
        <span style={{ color: "var(--agent-warning)" }}>Typical</span>
        <span style={{ color: "var(--agent-danger)" }}>Slow &gt;100d</span>
      </div>
    </div>
  );
}
