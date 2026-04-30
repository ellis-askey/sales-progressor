export default function AnalyticsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header */}
      <div
        className="agent-glass-strong px-4 pt-[18px] pb-[22px] sm:px-8 sm:pt-[22px] sm:pb-[26px]"
        style={{ borderBottom: "0.5px solid var(--agent-glass-border)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="agent-skeleton" style={{ height: 26, width: 130, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 13, width: 240, borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="agent-skeleton" style={{ height: 32, width: 110, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 32, width: 96, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-8 flex flex-col" style={{ gap: 18 }}>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {[88, 100, 86, 78].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 34, width: w, borderRadius: 99, flexShrink: 0 }} />
          ))}
        </div>

        {/* Counts — 3-col card */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 64, borderRadius: 6, marginBottom: 8 }} />
                <div className="agent-skeleton" style={{ height: 28, width: 46, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 80, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Funnel + Speed — 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="agent-glass" style={{ padding: "16px 20px" }}>
              <div className="agent-skeleton" style={{ height: 10, width: 120, borderRadius: 6, marginBottom: 14 }} />
              {[85, 55, 35].map((w, j) => (
                <div key={j} className="agent-skeleton" style={{ height: 10, width: `${w}%`, borderRadius: 3, marginBottom: 10 }} />
              ))}
            </div>
          ))}
        </div>

        {/* Values — 2-col card */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 88, borderRadius: 6, marginBottom: 8 }} />
                <div className="agent-skeleton" style={{ height: 24, width: 110, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 72, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Fees — 3-col card */}
        <div className="agent-glass" style={{ padding: "16px 20px" }}>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 10, width: 68, borderRadius: 6, marginBottom: 4 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 80, borderRadius: 6, marginBottom: 6 }} />
                <div className="agent-skeleton" style={{ height: 22, width: 74, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Fee forecast card */}
        <div className="agent-glass" style={{ padding: "18px 22px" }}>
          <div className="agent-skeleton" style={{ height: 10, width: 96, borderRadius: 6, marginBottom: 14 }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 14 }}>
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="agent-skeleton" style={{ height: 9, width: 130, borderRadius: 6, marginBottom: 6 }} />
                <div className="agent-skeleton" style={{ height: 24, width: 100, borderRadius: 6, marginBottom: 4 }} />
                <div className="agent-skeleton" style={{ height: 9, width: 90, borderRadius: 6 }} />
              </div>
            ))}
          </div>
          <div className="agent-skeleton" style={{ height: 5, width: "100%", borderRadius: 3 }} />
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

        {/* Solicitor performance list */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div className="agent-skeleton" style={{ height: 13, width: 220, borderRadius: 6, marginBottom: 5 }} />
            <div className="agent-skeleton" style={{ height: 10, width: 280, borderRadius: 6 }} />
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: "11px 20px", borderTop: "0.5px solid var(--agent-border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}
            >
              <div className="agent-skeleton" style={{ height: 13, width: 160, borderRadius: 6 }} />
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="agent-skeleton" style={{ height: 11, width: 70, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ height: 11, width: 50, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ height: 20, width: 46, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Missing fees list */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div className="agent-skeleton" style={{ height: 13, width: 150, borderRadius: 6, marginBottom: 5 }} />
            <div className="agent-skeleton" style={{ height: 10, width: 260, borderRadius: 6 }} />
          </div>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: "12px 20px", borderTop: "0.5px solid var(--agent-border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 10, width: 110, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
