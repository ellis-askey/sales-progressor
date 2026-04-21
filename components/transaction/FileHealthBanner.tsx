"use client";

import { useTabContext } from "./TabContext";

type Props = {
  overdueCount: number;
  onTrack: boolean;
};

export function FileHealthBanner({ overdueCount, onTrack }: Props) {
  const { setActiveTab } = useTabContext();

  if (overdueCount === 0 && onTrack) return null;

  const isRed = overdueCount > 0 && !onTrack;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
      isRed
        ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"
    }`}>
      <svg
        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isRed ? "text-red-500" : "text-amber-500"}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          {overdueCount > 0 && (
            <p className={`text-xs font-semibold ${isRed ? "text-red-700" : "text-amber-700"}`}>
              {overdueCount} reminder{overdueCount !== 1 ? "s" : ""} overdue
            </p>
          )}
          {!onTrack && (
            <p className={`text-xs ${isRed ? "text-red-600" : "text-amber-600"}`}>
              File may be behind schedule
            </p>
          )}
        </div>
      </div>
      {overdueCount > 0 && (
        <button
          onClick={() => setActiveTab("reminders")}
          className={`text-xs font-medium flex-shrink-0 ${
            isRed ? "text-red-600 hover:text-red-800" : "text-amber-700 hover:text-amber-900"
          } transition-colors`}
        >
          View reminders →
        </button>
      )}
    </div>
  );
}
