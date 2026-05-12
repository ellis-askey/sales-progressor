"use client";

import { useTabContext } from "./TabContext";
import { formatDate, daysUntil } from "@/lib/utils";

type ReminderItem = {
  id: string;
  ruleName: string;
  nextDueDate: Date | string;
  pendingChaseCount: number;
};

type Props = {
  reminders: ReminderItem[];
  totalActive: number;
};

export function RemindersWidget({ reminders, totalActive }: Props) {
  const { setActiveTab } = useTabContext();

  return (
    <div className="glass-card overflow-hidden rounded-[12px]">
      {/* Header */}
      <div className="agent-card-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="agent-card-title">Reminders</h3>
          {totalActive > 0 && <span className="agent-badge">{totalActive}</span>}
        </div>
        <button onClick={() => setActiveTab("reminders")} className="agent-link" style={{ fontSize: 11 }}>
          View all →
        </button>
      </div>

      {/* Reminder rows */}
      {reminders.length === 0 ? (
        <div style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>No reminders due</p>
        </div>
      ) : (
        <div>
          {reminders.map((r) => {
            const days = daysUntil(r.nextDueDate);
            const isOverdue = days < 0;
            const isToday = days === 0;
            const dotColor = isOverdue ? "#ef4444" : isToday ? "var(--agent-coral)" : "rgba(15,23,42,0.18)";
            const daysText = isOverdue
              ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
              : isToday ? "Due today"
              : `From ${formatDate(r.nextDueDate)}`;
            return (
              <div key={r.id} className={isOverdue ? "agent-hover-row-warning" : "agent-hover-row"} style={{ padding: "8px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: dotColor }} />
                  <span style={{ fontSize: 11, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ruleName}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--agent-text-muted)", flexShrink: 0, marginLeft: 8 }}>{daysText}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
