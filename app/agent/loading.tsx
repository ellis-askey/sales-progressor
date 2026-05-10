import { PageHeader } from "@/components/layout/PageHeader";

export default function AgentLoading() {
  return (
    <>
      <PageHeader title="Loading…" subtitle=" " />

      <div className="px-4 md:px-8 py-2 md:py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonCard height={88} />
        <SkeletonCard height={64} />
        <SkeletonCard height={64} />
        <SkeletonCard height={64} />
      </div>
    </>
  );
}

function SkeletonCard({ height }: { height: number }) {
  return (
    <div className="glass-card" style={{ padding: "16px 20px", height, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
      <div className="agent-skeleton" style={{ width: "55%", height: 13, borderRadius: 6 }} />
      <div className="agent-skeleton" style={{ width: "35%", height: 11, borderRadius: 6 }} />
    </div>
  );
}
