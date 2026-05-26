export default function AgentTransactionLoading() {
  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8" style={{ minHeight: "100vh" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden rounded-[16px]" style={{ marginBottom: 20 }}>
        {/* Back link */}
        <div style={{ padding: "12px 16px 0" }}>
          <div className="agent-skeleton" style={{ height: 11, width: 48, borderRadius: 6 }} />
        </div>

        {/* Address */}
        <div style={{ padding: "10px 16px 0" }}>
          <div className="agent-skeleton" style={{ height: 24, width: "55%", borderRadius: 8 }} />
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", flexWrap: "wrap" }}>
          {[56, 72, 80, 96, 120].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 22, width: w, borderRadius: 99 }} />
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, padding: "14px 16px 0", borderBottom: "0.5px solid var(--agent-border-default)" }}>
          {[72, 52, 90, 56, 68].map((w, i) => (
            <div key={i} style={{ padding: "0 12px 10px", borderBottom: i === 0 ? "2px solid var(--agent-coral)" : "2px solid transparent" }}>
              <div className="agent-skeleton" style={{ height: 11, width: w, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Responsive layout ─────────────────────────────────────────────
       * Mobile (<768px): stack — main content first, sidebar beneath.
       * Desktop (>=768px): two-column with sticky-ish sidebar to the right.
       * Previously this was a hard-coded `display: flex` row with a fixed
       * 288px sidebar, which on a phone produced the broken
       * narrow-main + wide-sidebar shape the user spotted. */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-5 md:items-start">

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Next steps card */}
          <div className="glass-card overflow-hidden rounded-[12px]">
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 80, borderRadius: 6 }} />
            </div>
            {[1, 2].map((i) => (
              <div key={i} style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div className="agent-skeleton" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />
                  <div>
                    <div className="agent-skeleton" style={{ height: 10, width: 60, borderRadius: 6, marginBottom: 5 }} />
                    <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6 }} />
                  </div>
                </div>
                <div className="agent-skeleton" style={{ height: 30, width: 80, borderRadius: 8, flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Reminders card */}
          <div className="glass-card overflow-hidden rounded-[12px]">
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", justifyContent: "space-between" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 72, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 56, borderRadius: 6 }} />
            </div>
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="agent-skeleton" style={{ width: 7, height: 7, borderRadius: "50%" }} />
                <div className="agent-skeleton" style={{ height: 11, width: 180, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 10, width: 64, borderRadius: 6 }} />
            </div>
          </div>

          {/* Recent activity card */}
          <div className="glass-card overflow-hidden rounded-[12px]">
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", justifyContent: "space-between" }}>
              <div className="agent-skeleton" style={{ height: 11, width: 100, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 56, borderRadius: 6 }} />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", gap: 10 }}>
                <div className="agent-skeleton" style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="agent-skeleton" style={{ height: 10, width: "35%", borderRadius: 6, marginBottom: 5 }} />
                  <div className="agent-skeleton" style={{ height: 11, width: "80%", borderRadius: 6 }} />
                </div>
                <div className="agent-skeleton" style={{ height: 10, width: 32, borderRadius: 6, flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Chain + Risk */}
          {[60, 60].map((h, i) => (
            <div key={i} className="glass-card overflow-hidden rounded-[12px]" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="agent-skeleton" style={{ height: 11, width: i === 0 ? 88 : 72, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 64, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Sidebar — full width on mobile (stacks under main), 288px column at md+ */}
        <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col gap-4">

          {/* Progress card */}
          <div className="glass-card overflow-hidden rounded-[12px]" style={{ padding: "16px" }}>
            <div className="agent-skeleton" style={{ height: 10, width: 64, borderRadius: 6, marginBottom: 14 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <div className="agent-skeleton" style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
              <div className="agent-skeleton" style={{ height: 22, width: 72, borderRadius: 8 }} />
            </div>
            <div className="agent-skeleton" style={{ height: 10, width: "70%", borderRadius: 6 }} />
          </div>

          {/* Exchange Forecast card */}
          <div className="glass-card overflow-hidden rounded-[12px]" style={{ padding: "16px" }}>
            <div className="agent-skeleton" style={{ height: 10, width: 112, borderRadius: 6, marginBottom: 14 }} />
            {[["12-week target", 90], ["Expected exchange", 80], ["Completion date", 96], ["Weeks to exchange", 40]].map(([, w], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="agent-skeleton" style={{ height: 10, width: 100, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ height: 10, width: w as number, borderRadius: 6 }} />
              </div>
            ))}
          </div>

          {/* Agent card */}
          <div className="glass-card overflow-hidden rounded-[12px]" style={{ padding: "16px" }}>
            <div className="agent-skeleton" style={{ height: 10, width: 40, borderRadius: 6, marginBottom: 14 }} />
            <div className="agent-skeleton" style={{ height: 13, width: 120, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 10, width: 90, borderRadius: 6, marginBottom: 5 }} />
            <div className="agent-skeleton" style={{ height: 10, width: 140, borderRadius: 6 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
