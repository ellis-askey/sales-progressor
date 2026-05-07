// What Sarah Mitchell sees in the buyer portal — progress card

export function PortalProgressCardExample() {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid rgba(0,0,0,0.10)",
      borderRadius: 16,
      padding: "20px 20px",
      maxWidth: 340,
      fontFamily: "inherit",
    }}>
      {/* Stage label */}
      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#FF6B4A", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Your purchase
      </p>
      <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
        Pack issued &amp; due diligence underway
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555", lineHeight: 1.5 }}>
        The contract pack has been sent to your solicitor. Searches have been ordered and enquiries are starting.
      </p>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Progress</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#FF6B4A" }}>38%</span>
        </div>
        <div style={{ height: 6, background: "rgba(0,0,0,0.07)", borderRadius: 999 }}>
          <div style={{ height: 6, width: "38%", background: "#FF8A65", borderRadius: 999 }} />
        </div>
      </div>
      {/* Next steps */}
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>What happens next</p>
      {[
        "Your solicitor reviews the contract pack and raises enquiries",
        "Search results are received (usually 3–4 weeks)",
        "Your mortgage offer is issued by your lender",
      ].map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF8A65", flexShrink: 0, marginTop: 6 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#444", lineHeight: 1.5 }}>{s}</p>
        </div>
      ))}
    </div>
  );
}
