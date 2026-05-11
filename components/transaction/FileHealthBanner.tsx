"use client";

import { useTabContext } from "./TabContext";

type Props = {
  overdueCount: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown";
};

export function FileHealthBanner({ overdueCount, onTrack }: Props) {
  const { setActiveTab } = useTabContext();

  const isBehind = onTrack === "at_risk" || onTrack === "off_track";

  if (overdueCount === 0 && !isBehind) return null;

  const isRed = overdueCount > 0 && isBehind;

  return (
    <div className={`agent-reveal-in rounded-xl border px-4 py-3 flex items-center justify-between ${
      isRed
        ? "bg-[var(--agent-danger-bg)] border-[var(--agent-danger-border)]"
        : "bg-[var(--agent-warning-bg)] border-[var(--agent-warning-border)]"
    }`}>
      <div className="flex flex-col gap-0.5">
        {overdueCount > 0 && (
          <p className={`text-xs font-semibold ${isRed ? "text-red-700" : "text-amber-700"}`}>
            {overdueCount} reminder{overdueCount !== 1 ? "s" : ""} overdue
          </p>
        )}
        {isBehind && (
          <p className={`text-xs ${isRed ? "text-red-600" : "text-amber-600"}`}>
            File may be behind schedule
          </p>
        )}
      </div>
      {overdueCount > 0 && (
        <button
          onClick={() => setActiveTab("reminders")}
          className="agent-link text-xs font-medium flex-shrink-0"
        >
          View reminders →
        </button>
      )}
    </div>
  );
}
