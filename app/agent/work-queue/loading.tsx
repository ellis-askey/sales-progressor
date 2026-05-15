import { PageHeader } from "@/components/layout/PageHeader";

export default function WorkQueueLoading() {
  return (
    <>
      <PageHeader title="Reminders" subtitle="What needs chasing, today and ahead.">
        <div className="agent-skeleton" style={{ height: 22, width: 72, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 88, borderRadius: 99 }} />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">
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
      <div style={{
        height: 36, borderRadius: 12,
        background: "var(--agent-glass-bg-subtle)",
        padding: "0 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
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
          className="agent-glass-strong"
          style={{ borderRadius: 20, borderLeft: `4px solid ${urgencyColor}`, overflow: "hidden", opacity: i > 0 ? 0.7 : 1 }}
        >
          <div style={{ padding: "6px 16px", background: "var(--agent-glass-bg-subtle)", borderBottom: "0.5px solid var(--agent-glass-border)" }}>
            <div className="agent-skeleton" style={{ height: 10, width: 88, borderRadius: 6 }} />
          </div>
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
