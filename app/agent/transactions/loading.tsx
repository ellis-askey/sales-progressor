/* Loading skeleton for /agent/transactions.
 * Added during transaction-list Stage 2 (work-queue loading.tsx as reference).
 * Mirrors the final layout: PageHeader shape + status tab strip + filter bar
 * + 6 row skeletons inside the agent-glass-strong table. */

import { PageHeader } from "@/components/layout/PageHeader";

export default function TransactionListLoading() {
  return (
    <>
      <PageHeader title="All Files" subtitle="Every file across the agency.">
        <div className="agent-skeleton" style={{ height: 32, width: 96, borderRadius: 8 }} />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-5">
        {/* Status tab strip skeleton */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[72, 78, 86, 98, 90].map((w, i) => (
            <div
              key={i}
              className="agent-skeleton"
              style={{ height: 28, width: w, borderRadius: 99 }}
            />
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="agent-glass-strong" style={{ padding: "12px 14px", borderRadius: "var(--agent-radius-xl)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="agent-skeleton" style={{ height: 32, width: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <div className="agent-skeleton" style={{ height: 26, width: 70, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 26, width: 60, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 26, width: 96, borderRadius: 8 }} />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="agent-glass-strong" style={{ borderRadius: 20, overflow: "hidden" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <TransactionRowSkeleton
              key={i}
              opacity={i > 0 ? 0.7 - i * 0.08 : 1}
              riskColor={i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#10b981"}
              isLast={i === 5}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function TransactionRowSkeleton({
  opacity,
  riskColor,
  isLast,
}: { opacity: number; riskColor: string; isLast: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        opacity,
        borderBottom: isLast ? "none" : "0.5px solid var(--agent-border-subtle)",
      }}
    >
      {/* Risk stripe */}
      <div style={{ background: riskColor, width: 4, alignSelf: "stretch", flexShrink: 0 }} />

      {/* Body */}
      <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div className="agent-skeleton" style={{ height: 14, width: "55%", borderRadius: 6 }} />
        <div className="agent-skeleton" style={{ height: 10, width: "32%", borderRadius: 6 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <div className="agent-skeleton" style={{ height: 20, width: 58, borderRadius: 99 }} />
          <div className="agent-skeleton" style={{ height: 20, width: 72, borderRadius: 99 }} />
          <div className="agent-skeleton" style={{ height: 20, width: 92, borderRadius: 99, marginLeft: "auto" }} />
        </div>
      </div>
    </div>
  );
}
