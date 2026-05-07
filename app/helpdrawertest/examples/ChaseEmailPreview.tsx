// Mockup of the chase drawer — tone selector + generated email preview

const TONE_COLORS: Record<string, { bg: string; color: string }> = {
  Friendly:        { bg: "#dcfce7", color: "#15803d" },
  Professional:    { bg: "#dbeafe", color: "#1d4ed8" },
  "Polite Yet Firm": { bg: "#fef9c3", color: "#a16207" },
  "Chase Up":      { bg: "#ffedd5", color: "#c2410c" },
  Urgent:          { bg: "#fee2e2", color: "#b91c1c" },
};

export function ChaseEmailPreviewExample() {
  const tone = "Polite Yet Firm";
  const tc = TONE_COLORS[tone];
  return (
    <div style={{
      background: "rgba(255,255,255,0.90)",
      border: "0.5px solid rgba(45,24,16,0.12)",
      borderRadius: 14,
      padding: "16px 18px",
      maxWidth: 380,
      fontFamily: "inherit",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#2D1810" }}>Chase email</p>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(45,24,16,0.50)" }}>VM7 — Draft contract pack issued · 22 Birchwood Lane</p>
      </div>
      {/* Channel + tone row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8" }}>Email</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: tc.bg, color: tc.color }}>{tone}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "rgba(45,24,16,0.07)", color: "#5A3A28" }}>Chase #2</span>
      </div>
      {/* Generated text area mockup */}
      <div style={{
        background: "#FFFBF5",
        border: "0.5px solid rgba(45,24,16,0.12)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 12,
        color: "#5A3A28",
        lineHeight: 1.7,
        marginBottom: 12,
        whiteSpace: "pre-wrap",
      }}>
        {`Dear James,\n\nI hope you are well. I am writing to follow up regarding the draft contract pack for 22 Birchwood Lane.\n\nWe are still awaiting the contract pack from your solicitors. Could you please chase Smith & Partners to confirm when this will be issued?\n\nKind regards,\nOlivia Chen\nHartwell Estates`}
      </div>
      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ padding: "7px 14px", borderRadius: 8, background: "#FF6B4A", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Send
        </button>
        <button style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(45,24,16,0.15)", color: "#5A3A28", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          Regenerate
        </button>
      </div>
    </div>
  );
}
