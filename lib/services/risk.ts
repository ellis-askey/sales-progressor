// lib/services/risk.ts
// Fall-through risk scoring for a transaction. Transparent — factors are exposed to the UI.

export type RiskLevel = "low" | "medium" | "high";

export type RiskFactor = {
  label: string;
  detail: string;
  triggered: boolean;
  impact: "high" | "medium" | "low";
};

export type RiskScore = {
  level: RiskLevel;
  score: number; // 0–100
  factors: RiskFactor[];
};

export type RiskInput = {
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown";
  escalatedTaskCount: number;
  overdueTaskCount: number;
  daysSinceLastActivity: number | null;
  daysStuckOnMilestone: number | null;
};

export function calculateRiskScore(input: RiskInput): RiskScore {
  const { onTrack, escalatedTaskCount, overdueTaskCount, daysSinceLastActivity, daysStuckOnMilestone } = input;

  const factors: RiskFactor[] = [
    {
      label: "Escalated chases",
      detail: escalatedTaskCount > 0
        ? `${escalatedTaskCount} task${escalatedTaskCount > 1 ? "s" : ""} escalated — repeated chases unanswered`
        : "No escalated chases",
      triggered: escalatedTaskCount > 0,
      impact: "high",
    },
    {
      label: "Progress vs pace",
      detail: onTrack === "off_track"
        ? "Significantly behind 12-week exchange target"
        : onTrack === "at_risk"
        ? "Slightly behind 12-week exchange target"
        : onTrack === "on_track"
        ? "Tracking on or ahead of 12-week target"
        : "No progress data yet to assess pace",
      triggered: onTrack === "off_track",
      impact: "high",
    },
    {
      label: "Multiple overdue tasks",
      detail: overdueTaskCount >= 2
        ? `${overdueTaskCount} overdue chase tasks — solicitor unresponsive`
        : overdueTaskCount === 1
        ? "1 overdue chase task"
        : "No overdue tasks",
      triggered: overdueTaskCount >= 2,
      impact: "medium",
    },
    {
      label: "Slow progress pace",
      detail: onTrack === "at_risk"
        ? "File is slightly behind the 12-week exchange target based on milestone velocity"
        : "Progress is on track",
      triggered: onTrack === "at_risk",
      impact: "medium",
    },
    {
      label: "No recent activity",
      detail: daysSinceLastActivity !== null
        ? `Last activity ${daysSinceLastActivity} day${daysSinceLastActivity !== 1 ? "s" : ""} ago`
        : "No activity recorded yet",
      triggered: daysSinceLastActivity !== null && daysSinceLastActivity >= 21,
      impact: "medium",
    },
    {
      label: "Single overdue task",
      detail: overdueTaskCount === 1 ? "1 chase task is overdue" : "No overdue tasks",
      triggered: overdueTaskCount === 1,
      impact: "low",
    },
    {
      label: "No recent milestone",
      detail: daysStuckOnMilestone !== null
        ? `No milestone completed in ${daysStuckOnMilestone} day${daysStuckOnMilestone !== 1 ? "s" : ""}`
        : "Milestone data unavailable",
      triggered: daysStuckOnMilestone !== null && daysStuckOnMilestone >= 14,
      impact: "low",
    },
  ];

  const POINTS: Record<RiskFactor["impact"], number> = { high: 40, medium: 20, low: 10 };
  const score = Math.min(100, factors.filter((f) => f.triggered).reduce((s, f) => s + POINTS[f.impact], 0));
  const level: RiskLevel = score >= 55 ? "high" : score >= 20 ? "medium" : "low";

  // Only expose unique factors (hide "single overdue" if "multiple overdue" triggered)
  const visible = factors.filter((f) => {
    if (f.label === "Single overdue task" && overdueTaskCount >= 2) return false;
    if (f.label === "Slow progress pace" && onTrack === "off_track") return false;
    return true;
  });

  return { level, score, factors: visible };
}

export const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low:    { label: "Low risk",    color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-400" },
  medium: { label: "Medium risk", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400" },
  high:   { label: "High risk",   color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500" },
};
