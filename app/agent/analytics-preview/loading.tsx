export default function AnalyticsPreviewLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header */}
      <div
        className="agent-glass-strong px-4 pt-[18px] pb-[22px] sm:px-8 sm:pt-[22px] sm:pb-[26px]"
        style={{ borderBottom: "0.5px solid var(--agent-glass-border)" }}
      >
        <div className="agent-skeleton" style={{ height: 26, width: 160, borderRadius: 6, marginBottom: 6 }} />
        <div className="agent-skeleton" style={{ height: 13, width: 240, borderRadius: 6 }} />
      </div>

      <div className="px-4 py-5 sm:px-8 flex flex-col" style={{ gap: 18 }}>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[90, 100, 85, 72].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 34, width: w, borderRadius: 99, flexShrink: 0 }} />
          ))}
        </div>

        {/* Counts — single card, 3-col */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 60, borderRadius: 6, marginBottom: 8 }} />
                <div className="agent-skeleton" style={{ height: 28, width: 48, borderRadius: 6, marginBottom: 6 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 80, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Values — single card, 2-col */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 80, borderRadius: 6, marginBottom: 8 }} />
                <div className="agent-skeleton" style={{ height: 24, width: 110, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 70, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Fees — single card, 3-col */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 65, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 80, borderRadius: 6, marginBottom: 7 }} />
                <div className="agent-skeleton" style={{ height: 22, width: 75, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Charts — 2-col on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "18px 22px" }}>
              <div className="agent-skeleton" style={{ height: 10, width: 180, borderRadius: 6, marginBottom: 14 }} />
              <div className="agent-skeleton" style={{ height: 120, width: "100%", borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Files missing a fee */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div className="agent-skeleton" style={{ height: 13, width: 160, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 11, width: 260, borderRadius: 6 }} />
          </div>
          {[1, 2].map((i) => (
            <div key={i} style={{
              padding: "12px 20px",
              borderTop: i > 1 ? "0.5px solid var(--agent-border-subtle)" : undefined,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 11, width: 120, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
