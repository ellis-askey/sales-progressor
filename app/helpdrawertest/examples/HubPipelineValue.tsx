// Hub pipeline value card — shows total active pipeline in £

export function HubPipelineValueExample() {
  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "14px 24px",
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      gap: 4,
    }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: "#2D1810", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        £3.45m
      </span>
      <span style={{ fontSize: 11, color: "rgba(45,24,16,0.55)", textAlign: "center" }}>
        Pipeline value
      </span>
    </div>
  );
}
