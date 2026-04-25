export default function AgentTransactionLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <div style={{ height: 56, background: "rgba(255,255,255,0.52)", borderBottom: "0.5px solid rgba(255,255,255,0.70)" }} />
      <div className="agent-skeleton" style={{ height: 96 }} />
      <div style={{ maxWidth: 896, margin: "0 auto", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {[160, 200, 140].map((h, i) => (
          <div key={i} className="agent-skeleton" style={{ height: h, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}
