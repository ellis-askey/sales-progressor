export type HealthScore = "green" | "amber" | "red";

export type HealthData = {
  score: HealthScore;
  overdueCount: number;
  escalatedCount: number;
  daysSinceLastActivity: number | null;
  nextActionLabel: string | null;
};

type RawHealthInput = {
  pendingOverdueTasks: number;
  escalatedTasks: number;
  lastActivityAt: Date | null;
  nextChaseLabel: string | null;
  nextMilestoneLabel: string | null;
};

export function computeHealth(input: RawHealthInput): HealthData {
  const { pendingOverdueTasks, escalatedTasks, lastActivityAt, nextChaseLabel, nextMilestoneLabel } = input;

  const daysSinceLastActivity = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86400000)
    : null;

  let score: HealthScore = "green";

  if (
    escalatedTasks > 0 ||
    pendingOverdueTasks >= 2 ||
    (daysSinceLastActivity !== null && daysSinceLastActivity >= 28)
  ) {
    score = "red";
  } else if (
    pendingOverdueTasks === 1 ||
    (daysSinceLastActivity !== null && daysSinceLastActivity >= 14)
  ) {
    score = "amber";
  }

  const nextActionLabel = nextChaseLabel ?? nextMilestoneLabel ?? null;

  return {
    score,
    overdueCount: pendingOverdueTasks,
    escalatedCount: escalatedTasks,
    daysSinceLastActivity,
    nextActionLabel,
  };
}

export const HEALTH_CONFIG: Record<HealthScore, { dot: string; label: string; border: string }> = {
  green: { dot: "bg-emerald-400", label: "text-emerald-700",  border: "border-emerald-200" },
  amber: { dot: "bg-amber-400",   label: "text-amber-700",   border: "border-amber-200" },
  red:   { dot: "bg-red-500",     label: "text-red-700",     border: "border-red-200" },
};
