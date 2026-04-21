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
    <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f0f4f8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <h3 className="text-xs font-semibold text-gray-700">Reminders</h3>
          {totalActive > 0 && (
            <span className="text-xs font-semibold rounded-full px-2 py-0.5 tabular-nums"
                  style={{ background: "rgba(249,115,22,0.12)", color: "#ea580c" }}>
              {totalActive}
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveTab("reminders")}
          className="text-xs text-gray-400 hover:text-blue-600 transition-colors font-semibold"
        >
          View all →
        </button>
      </div>

      {/* Reminder rows */}
      {reminders.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-gray-400 italic">No reminders due</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f4f8]">
          {reminders.map((r) => {
            const days = daysUntil(r.nextDueDate);
            const isOverdue = days < 0;
            const isToday = days === 0;
            return (
              <div key={r.id} className={`px-4 py-3 flex items-center gap-3 ${isOverdue ? "bg-red-50/60" : ""}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isOverdue ? "bg-red-500" : isToday ? "bg-orange-500" : "bg-gray-300"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isOverdue ? "text-gray-800" : "text-gray-700"}`}>
                    {r.ruleName}
                  </p>
                  <p className={`text-xs mt-0.5 font-medium ${
                    isOverdue ? "text-red-600" : isToday ? "text-orange-600" : "text-gray-400"
                  }`}>
                    {isOverdue
                      ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
                      : isToday
                      ? "Due today"
                      : `Due ${formatDate(r.nextDueDate)}`}
                  </p>
                </div>
                {r.pendingChaseCount > 0 && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0 tabular-nums"
                        style={{ background: "rgba(249,115,22,0.12)", color: "#ea580c", border: "1px solid rgba(249,115,22,0.20)" }}>
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
