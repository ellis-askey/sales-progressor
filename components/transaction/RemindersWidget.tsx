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
    <div className="glass-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-900/70">Reminders</h3>
          {totalActive > 0 && (
            <span className="agent-badge">{totalActive}</span>
          )}
        </div>
        <button
          onClick={() => setActiveTab("reminders")}
          className="text-xs agent-link"
        >
          View all →
        </button>
      </div>

      {/* Reminder rows */}
      {reminders.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-slate-900/30 italic">No reminders due</p>
        </div>
      ) : (
        <div className="divide-y divide-white/15">
          {reminders.map((r) => {
            const days = daysUntil(r.nextDueDate);
            const isOverdue = days < 0;
            const isToday = days === 0;
            return (
              <div key={r.id} className={`px-4 py-3 flex items-center gap-3 ${isOverdue ? "bg-red-50/60" : ""}`}>
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? "bg-red-500" : !isToday ? "bg-slate-900/20" : ""}`}
                  style={isToday && !isOverdue ? { background: "var(--agent-coral)" } : undefined}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isOverdue ? "text-slate-900/90" : "text-slate-900/80"}`}>
                    {r.ruleName}
                  </p>
                  <p
                    className={`text-xs mt-0.5 font-medium ${isOverdue ? "text-red-600" : !isToday ? "text-slate-900/40" : ""}`}
                    style={isToday && !isOverdue ? { color: "var(--agent-coral-deep)" } : undefined}
                  >
                    {isOverdue
                      ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
                      : isToday
                      ? "Due today"
                      : `Active from ${formatDate(r.nextDueDate)}`}
                  </p>
                </div>
                {r.pendingChaseCount > 0 && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0 tabular-nums"
                        style={{ background: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)", border: "1px solid rgba(var(--agent-coral-base-rgb),0.20)" }}>
                    {r.pendingChaseCount} chase{r.pendingChaseCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
