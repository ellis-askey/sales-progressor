export default function HubPreviewLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header skeleton */}
      <div
        className="agent-glass-strong"
        style={{
          padding: "22px 32px 26px",
          borderBottom: "0.5px solid var(--agent-glass-border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="agent-skeleton" style={{ height: 12, width: 90, borderRadius: 6 }} />
          <div className="agent-skeleton" style={{ height: 12, width: 100, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="agent-skeleton" style={{ height: 26, width: 220, borderRadius: 6, marginBottom: 8 }} />
            <div className="agent-skeleton" style={{ height: 13, width: 160, borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="agent-skeleton" style={{ height: 36, width: 140, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Pipeline + Momentum row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div className="agent-skeleton" style={{ height: 11, width: 110, borderRadius: 6, marginBottom: 6 }} />
                <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 24, width: 72, borderRadius: 99 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[120, 80, 70, 100].map((w, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div className="agent-skeleton" style={{ height: 24, width: w, borderRadius: 6 }} />
                  <div className="agent-skeleton" style={{ height: 11, width: 60, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="agent-glass" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="agent-skeleton" style={{ width: 80, height: 80, borderRadius: "50%", marginBottom: 12 }} />
          </div>
        </div>

        {/* Needs attention */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="agent-skeleton" style={{ height: 13, width: 160, borderRadius: 6, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 220, borderRadius: 6 }} />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: "13px 20px 13px 17px",
              borderLeft: "3px solid var(--agent-border-subtle)",
              borderTop: i > 1 ? "0.5px solid var(--agent-border-subtle)" : undefined,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 11, width: 140, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 11, width: 50, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Forecast + Service split */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div className="agent-skeleton" style={{ height: 11, width: 120, borderRadius: 6, marginBottom: 8 }} />
            <div className="agent-skeleton" style={{ height: 60, width: "100%", borderRadius: 6, marginBottom: 12 }} />
            <div className="agent-skeleton" style={{ height: 12, width: "80%", borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 12, width: "60%", borderRadius: 6 }} />
          </div>
          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div className="agent-skeleton" style={{ height: 11, width: 100, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div className="agent-skeleton" style={{ width: 80, height: 80, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div className="agent-skeleton" style={{ height: 12, width: "100%", borderRadius: 6, marginBottom: 10 }} />
                <div className="agent-skeleton" style={{ height: 12, width: "70%", borderRadius: 6 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
