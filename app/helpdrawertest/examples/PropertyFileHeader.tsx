// Property file header — address, status badge, progress bar, assigned negotiator

export function PropertyFileHeaderExample() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      padding: "16px 18px",
      maxWidth: 380,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#2D1810", lineHeight: 1.2 }}>22 Birchwood Lane</p>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(45,24,16,0.50)" }}>Assigned to Olivia Chen</p>
        </div>
        <span style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(31,138,74,0.10)",
          border: "1px solid rgba(31,138,74,0.25)",
          color: "#1F8A4A",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}>
          Active
        </span>
      </div>
      {/* Progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: "rgba(45,24,16,0.50)" }}>Overall progress</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#FF6B4A" }}>42%</span>
        </div>
        <div style={{ height: 5, background: "rgba(45,24,16,0.08)", borderRadius: 999 }}>
          <div style={{ height: 5, width: "42%", background: "#FF8A65", borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
