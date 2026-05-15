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

  const dangerColor = isRed ? "var(--agent-danger)" : "var(--agent-warning)";
  const borderColor = isRed ? "rgba(199,62,62,0.40)" : "rgba(201,125,26,0.40)";

  return (
    <div
      className={`agent-reveal-in mobile-alert-banner${isRed ? " mobile-alert-banner--danger" : " mobile-alert-banner--warning"}`}
      style={{
        background: "rgba(255,255,255,0.88)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {overdueCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: dangerColor }}>
            {overdueCount} reminder{overdueCount !== 1 ? "s" : ""} overdue
          </span>
        )}
        {isBehind && (
          <span style={{ fontSize: 12, color: dangerColor }}>
            File may be behind schedule
          </span>
        )}
      </div>
      {overdueCount > 0 && (
        <button
          onClick={() => setActiveTab("reminders")}
          className="agent-link"
          style={{ fontSize: 12, flexShrink: 0 }}
        >
          View reminders →
        </button>
      )}
    </div>
  );
}
