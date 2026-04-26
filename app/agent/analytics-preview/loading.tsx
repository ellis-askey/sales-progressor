export default function AnalyticsPreviewLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header */}
      <div className="agent-glass-strong" style={{ padding: "22px 32px 26px", borderBottom: "0.5px solid var(--agent-glass-border)" }}>
        <div className="agent-skeleton" style={{ height: 11, width: 120, borderRadius: 6, marginBottom: 14 }} />
        <div className="agent-skeleton" style={{ height: 26, width: 180, borderRadius: 6, marginBottom: 6 }} />
        <div className="agent-skeleton" style={{ height: 13, width: 100, borderRadius: 6 }} />
      </div>

      <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[60, 60, 50, 70].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 28, width: w, borderRadius: 99 }} />
          ))}
        </div>

        {/* Count cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "18px 22px" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 100, borderRadius: 6, marginBottom: 10 }} />
              <div className="agent-skeleton" style={{ height: 28, width: 60, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Value cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[1, 2].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "18px 22px" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 110, borderRadius: 6, marginBottom: 10 }} />
              <div className="agent-skeleton" style={{ height: 26, width: 130, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Fee cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "18px 22px" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 120, borderRadius: 6, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 80, borderRadius: 6, marginBottom: 10 }} />
              <div className="agent-skeleton" style={{ height: 26, width: 110, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[1, 2].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "18px 22px" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 180, borderRadius: 6, marginBottom: 14 }} />
              <div className="agent-skeleton" style={{ height: 150, width: "100%", borderRadius: 6 }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
