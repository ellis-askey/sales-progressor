import { PageHeader } from "@/components/layout/PageHeader";

export default function CompletionsLoading() {
  return (
    <>
      <PageHeader title="Completions" subtitle="Files that have exchanged and are heading to completion.">
        <div className="agent-skeleton" style={{ height: 22, width: 68, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 82, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 74, borderRadius: 99 }} />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Pipeline summary line */}
        <div className="agent-skeleton" style={{ height: 13, width: 240, borderRadius: 6 }} />

        {/* Group skeletons */}
        {[
          { color: "#dc2626", label: 90 },
          { color: "#d97706", label: 130 },
          { color: "#3b82f6", label: 150 },
        ].map(({ color, label }, gi) => (
          <div key={gi}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 99,
              background: "rgba(0,0,0,0.04)",
              marginBottom: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, opacity: 0.4 }} />
              <div className="agent-skeleton" style={{ height: 12, width: label, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ height: 18, width: 24, borderRadius: 99 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[0, 1].map((ri) => (
                <div key={ri} style={{
                  padding: "12px 16px",
                  borderTop: ri > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                  border: "0.5px solid var(--agent-border-subtle)",
                  borderRadius: ri === 0 ? "8px 8px 0 0" : "0 0 8px 8px",
                  borderBottom: ri === 1 ? "0.5px solid var(--agent-border-subtle)" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  background: "rgba(255,255,255,0.55)",
                }}>
                  <div>
                    <div className="agent-skeleton" style={{ height: 13, width: 200, borderRadius: 6, marginBottom: 5 }} />
                    <div className="agent-skeleton" style={{ height: 11, width: 130, borderRadius: 6 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <div className="agent-skeleton" style={{ height: 11, width: 60, borderRadius: 6 }} />
                    <div className="agent-skeleton" style={{ height: 22, width: 52, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </>
  );
}
