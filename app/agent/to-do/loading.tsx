export default function TodoLoading() {
  return (
    <>
      {/* Header — matches to-do page header exactly */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="relative px-4 pt-6 pb-7 md:px-8">
          <div className="agent-skeleton" style={{ height: 28, width: 80, borderRadius: 8, marginBottom: 8 }} />
          <div className="agent-skeleton" style={{ height: 13, width: 260, borderRadius: 6, marginBottom: 14 }} />
          {/* Stat segments */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[65, 110, 75].map((w, i) => (
              <div key={i} className="agent-skeleton" style={{ height: 12, width: w, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-8 py-5 md:py-7" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Add task form skeleton */}
          <div style={{ display: "flex", gap: 8 }}>
            <div className="agent-skeleton" style={{ flex: 1, height: 40, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 40, width: 88, borderRadius: 8, flexShrink: 0 }} />
          </div>

          {/* "My to-dos" section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
              <div className="agent-skeleton" style={{ height: 13, width: 70, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 20, width: 28, borderRadius: 99 }} />
            </div>

            {/* Task group cards */}
            {[
              { addrW: 200, rows: 2 },
              { addrW: 160, rows: 1 },
            ].map(({ addrW, rows }, gi) => (
              <div key={gi} className="glass-card" style={{ overflow: "hidden" }}>
                {/* Address header */}
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.35)" }}>
                  <div className="agent-skeleton" style={{ height: 13, width: addrW, borderRadius: 6 }} />
                </div>
                {/* Task rows */}
                {Array.from({ length: rows }).map((_, ri) => (
                  <div key={ri} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "12px 16px",
                    borderBottom: ri < rows - 1 ? "0.5px solid rgba(255,255,255,0.25)" : "none",
                  }}>
                    {/* Toggle circle */}
                    <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                    {/* Task text */}
                    <div style={{ flex: 1 }}>
                      <div className="agent-skeleton" style={{ height: 13, width: ri === 0 ? 220 : 170, borderRadius: 6 }} />
                    </div>
                    {/* Date */}
                    <div className="agent-skeleton" style={{ height: 11, width: 65, borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* "With your progressor" section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
              <div className="agent-skeleton" style={{ height: 13, width: 130, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 20, width: 28, borderRadius: 99 }} />
            </div>

            {/* Task group card */}
            <div className="glass-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.35)" }}>
                <div className="agent-skeleton" style={{ height: 13, width: 185, borderRadius: 6 }} />
              </div>
              {[220, 150].map((w, ri) => (
                <div key={ri} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px",
                  borderBottom: ri === 0 ? "0.5px solid rgba(255,255,255,0.25)" : "none",
                }}>
                  <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div className="agent-skeleton" style={{ height: 13, width: w, borderRadius: 6 }} />
                  </div>
                  <div className="agent-skeleton" style={{ height: 11, width: 65, borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
