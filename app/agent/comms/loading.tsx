import { PageHeader } from "@/components/layout/PageHeader";

export default function CommsLoading() {
  return (
    <>
      <PageHeader title="Updates" subtitle="Milestone activity across all your files.">
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
          <div className="agent-skeleton" style={{ height: 30, width: 100, borderRadius: 7 }} />
          <div className="agent-skeleton" style={{ height: 30, width: 130, borderRadius: 7 }} />
        </div>
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-6">
        <DayBucketSkeleton milestoneCount={3} />
        <DayBucketSkeleton milestoneCount={2} />
        <DayBucketSkeleton milestoneCount={2} />
      </div>
    </>
  );
}

function DayBucketSkeleton({ milestoneCount }: { milestoneCount: number }) {
  return (
    <div>
      {/* Day label */}
      <div className="agent-skeleton" style={{ height: 12, width: 80, borderRadius: 6, marginBottom: 10 }} />

      {/* Transaction group */}
      <div className="agent-glass-strong" style={{ borderRadius: 16, overflow: "hidden" }}>
        {/* Address header */}
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
          <div className="agent-skeleton" style={{ height: 13, width: 200, borderRadius: 6 }} />
        </div>
        {/* Milestone rows */}
        {Array.from({ length: milestoneCount }).map((_, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px",
            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
            opacity: i > 0 ? 0.75 : 1,
          }}>
            <div className="agent-skeleton" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="agent-skeleton" style={{ height: 12, width: "55%", borderRadius: 6, marginBottom: 5 }} />
              <div className="agent-skeleton" style={{ height: 10, width: "35%", borderRadius: 6 }} />
            </div>
            <div className="agent-skeleton" style={{ height: 10, width: 52, borderRadius: 6, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
