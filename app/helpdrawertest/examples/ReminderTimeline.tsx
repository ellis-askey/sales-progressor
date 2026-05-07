// Diagram showing grace days → repeat → escalation flow

export function ReminderTimelineExample() {
  const steps = [
    { label: "Milestone unlocked", sub: "Clock starts", color: "rgba(45,24,16,0.25)", fill: false },
    { label: "Grace period", sub: "No chase shown", color: "#3D7AB8", fill: true },
    { label: "Chase 1", sub: "Due today", color: "#FF8A65", fill: true },
    { label: "Chase 2", sub: "+N days later", color: "#C97D1A", fill: true },
    { label: "Chase 3", sub: "Escalated", color: "#C73E3E", fill: true },
  ];

  return (
    <div style={{ background: "rgba(255,255,255,0.70)", border: "0.5px solid rgba(45,24,16,0.10)", borderRadius: 12, padding: "16px 18px", maxWidth: 380 }}>
      <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: "rgba(45,24,16,0.45)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Reminder lifecycle
      </p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflow: "hidden" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {/* connector line */}
            {i < steps.length - 1 && (
              <div style={{ position: "absolute", top: 9, left: "50%", width: "100%", height: 2, background: "rgba(45,24,16,0.10)", zIndex: 0 }} />
            )}
            {/* dot */}
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: s.fill ? s.color : "#FFF5EC",
              border: `2px solid ${s.color}`,
              zIndex: 1, flexShrink: 0,
            }} />
            <p style={{ margin: "6px 0 2px", fontSize: 10, fontWeight: 600, color: "#2D1810", textAlign: "center", lineHeight: 1.2 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 9, color: "rgba(45,24,16,0.50)", textAlign: "center" }}>{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
