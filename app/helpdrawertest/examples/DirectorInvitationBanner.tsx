// Director invitation banner — "you've been invited to join Hartwell Estates"

export function DirectorInvitationBannerExample() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      padding: "18px 20px",
      maxWidth: 380,
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px", borderRadius: 999,
        background: "rgba(255,138,101,0.10)", border: "0.5px solid rgba(255,138,101,0.25)",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B4A", letterSpacing: "0.04em", textTransform: "uppercase" }}>Invitation</span>
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#2D1810", lineHeight: 1.2 }}>
        You&apos;ve been invited to join Hartwell Estates
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#5A3A28", lineHeight: 1.5 }}>
        Tom Hartwell has invited you to manage sales progression for Hartwell Estates on Sales Progressor.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ padding: "8px 16px", borderRadius: 8, background: "#FF6B4A", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Accept invitation
        </button>
        <button style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(45,24,16,0.15)", color: "#5A3A28", fontSize: 13, cursor: "pointer" }}>
          Decline
        </button>
      </div>
    </div>
  );
}
