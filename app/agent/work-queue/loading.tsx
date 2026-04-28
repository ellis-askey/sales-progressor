export default function WorkQueueLoading() {
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
        <div className="agent-skeleton" style={{ height: 28, width: 140, borderRadius: 8, marginBottom: 8 }} />
        <div className="agent-skeleton" style={{ height: 11, width: 200, borderRadius: 6, marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div className="agent-skeleton" style={{ height: 12, width: 68, borderRadius: 6 }} />
          <div className="agent-skeleton" style={{ height: 12, width: 80, borderRadius: 6 }} />
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-4">
        {/* Search + filter bar */}
        <div
          style={{
            borderRadius: 10,
            background: "rgba(255,245,236,0.7)",
            padding: "10px 16px",
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div className="agent-skeleton" style={{ height: 34, width: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {[46, 52, 46, 60, 68].map((w, i) => (
              <div key={i} className="agent-skeleton" style={{ height: 26, width: w, borderRadius: 8 }} />
            ))}
          </div>
        </div>

        {/* Urgency groups */}
        <ReminderGroupSkeleton rows={2} urgencyColor="#dc2626" />
        <ReminderGroupSkeleton rows={3} urgencyColor="#ea580c" />
        <ReminderGroupSkeleton rows={2} urgencyColor="#d97706" />
      </div>
    </>
  );
}

function ReminderGroupSkeleton({ rows, urgencyColor }: { rows: number; urgencyColor: string }) {
  return (
    <div className="space-y-2">
      {/* Group header chip */}
      <div
        style={{
          height: 36, borderRadius: 12,
          background: "rgba(255,255,255,0.40)",
          padding: "0 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="agent-skeleton" style={{ height: 11, width: 65, borderRadius: 6 }} />
          <div className="agent-skeleton" style={{ height: 18, width: 22, borderRadius: 99 }} />
        </div>
        <div className="agent-skeleton" style={{ height: 11, width: 30, borderRadius: 6 }} />
      </div>

      {/* Reminder card rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="glass-card"
          style={{ borderRadius: 20, borderLeft: `4px solid ${urgencyColor}`, overflow: "hidden", opacity: i > 0 ? 0.7 : 1 }}
        >
          {/* Status bar */}
          <div style={{ padding: "6px 16px", background: "rgba(255,255,255,0.20)", borderBottom: "0.5px solid rgba(255,255,255,0.30)" }}>
            <div className="agent-skeleton" style={{ height: 10, width: 88, borderRadius: 6 }} />
          </div>
          {/* Body */}
          <div style={{ padding: "12px 20px" }}>
            <div className="agent-skeleton" style={{ height: 13, width: "65%", borderRadius: 6, marginBottom: 7 }} />
            <div className="agent-skeleton" style={{ height: 10, width: "42%", borderRadius: 6 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 12 }}>
              <div className="agent-skeleton" style={{ height: 28, width: 76, borderRadius: 8 }} />
              <div className="agent-skeleton" style={{ height: 28, width: 66, borderRadius: 8 }} />
              <div className="agent-skeleton" style={{ height: 28, width: 28, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
