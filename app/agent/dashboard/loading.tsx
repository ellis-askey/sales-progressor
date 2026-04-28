export default function DashboardLoading() {
  return (
    <>
      {/* Header */}
      <div
        className="px-4 pt-6 pb-7 md:px-8"
        style={{
          background: "rgba(255,255,255,0.52)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderBottom: "0.5px solid rgba(255,255,255,0.70)",
          boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="agent-skeleton" style={{ height: 28, width: 110, borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <div className="agent-skeleton" style={{ height: 36, width: 100, borderRadius: 8 }} />
            <div className="agent-skeleton" style={{ height: 36, width: 180, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-5">
        {/* Filter tab bar */}
        <div
          style={{
            display: "flex", gap: 4, padding: 4,
            borderRadius: 12,
            background: "rgba(255,255,255,0.40)",
            overflowX: "auto",
          }}
        >
          {[48, 40, 68, 86, 80].map((w, i) => (
            <div
              key={i}
              className="agent-skeleton"
              style={{ height: 32, width: w, borderRadius: 8, flexShrink: 0 }}
            />
          ))}
        </div>

        {/* Transaction list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TransactionSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}

function TransactionSkeleton() {
  return (
    <div className="glass-card" style={{ padding: "14px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="agent-skeleton" style={{ height: 14, width: "62%", borderRadius: 6, marginBottom: 7 }} />
          <div className="agent-skeleton" style={{ height: 11, width: "38%", borderRadius: 6 }} />
        </div>
        <div className="agent-skeleton" style={{ height: 22, width: 58, borderRadius: 99, flexShrink: 0 }} />
      </div>
    </div>
  );
}
