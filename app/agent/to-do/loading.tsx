import { PageHeader } from "@/components/layout/PageHeader";

export default function TodoLoading() {
  return (
    <>
      <PageHeader title="To-Do" subtitle="Your notes, plus anything you've flagged to your progressor.">
        <div className="agent-skeleton" style={{ height: 22, width: 72, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 88, borderRadius: 99 }} />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Add task form skeleton */}
          <div style={{ display: "flex", gap: 8 }}>
            <div className="agent-skeleton" style={{ flex: 1, height: 40, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 40, width: 88, borderRadius: 8, flexShrink: 0 }} />
          </div>

          {/* "My to-dos" section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
              <div className="agent-skeleton" style={{ height: 13, width: 70, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 20, width: 28, borderRadius: 99 }} />
            </div>

            {[
              { addrW: 200, rows: 2 },
              { addrW: 160, rows: 1 },
            ].map(({ addrW, rows }, gi) => (
              <div key={gi} className="glass-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.35)" }}>
                  <div className="agent-skeleton" style={{ height: 13, width: addrW, borderRadius: 6 }} />
                </div>
                {Array.from({ length: rows }).map((_, ri) => (
                  <div key={ri} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "12px 16px",
                    borderBottom: ri < rows - 1 ? "0.5px solid rgba(255,255,255,0.25)" : "none",
                  }}>
                    <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div className="agent-skeleton" style={{ height: 13, width: ri === 0 ? 220 : 170, borderRadius: 6 }} />
                    </div>
                    <div className="agent-skeleton" style={{ height: 11, width: 65, borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* "With your progressor" section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
              <div className="agent-skeleton" style={{ height: 13, width: 130, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 20, width: 28, borderRadius: 99 }} />
            </div>

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
