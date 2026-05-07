// Pending negotiator in the team list — invitation sent, not yet accepted

export function NegotiatorInvitationPendingExample() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      padding: "12px 16px",
      maxWidth: 380,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "rgba(45,24,16,0.06)",
        border: "2px dashed rgba(45,24,16,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: "rgba(45,24,16,0.35)" }}>OC</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "rgba(45,24,16,0.55)" }}>Olivia Chen</p>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(45,24,16,0.40)" }}>olivia@hartwellestates.co.uk</p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
        background: "rgba(201,125,26,0.10)", border: "0.5px solid rgba(201,125,26,0.25)",
        color: "#C97D1A", letterSpacing: "0.04em", whiteSpace: "nowrap",
      }}>
        Pending
      </span>
    </div>
  );
}
