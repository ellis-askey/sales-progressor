export default function AgentLoading() {
  return (
    <>
      {/* Header skeleton */}
      <div className="px-4 pt-6 pb-7 md:px-8" style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
      }}>
        <div className="agent-skeleton" style={{ width: 80, height: 11, borderRadius: 6, marginBottom: 14 }} />
        <div className="agent-skeleton" style={{ width: 200, height: 28, borderRadius: 8, marginBottom: 8 }} />
        <div className="agent-skeleton" style={{ width: 140, height: 13, borderRadius: 6 }} />
      </div>

      {/* Content skeleton */}
      <div className="px-4 md:px-8 py-7" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
