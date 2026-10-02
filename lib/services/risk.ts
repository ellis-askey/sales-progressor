// lib/services/risk.ts
// Fall-through risk scoring for a transaction. Transparent — factors are exposed to the UI.

export type RiskLevel = "low" | "medium" | "high" | "no_data" | "exchanged";

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
  // Plain status line shown in place of risk factors when a file is simply
  // parked (currently only the deposit-transfer wait — critique #15).
  note?: string;
};

// Points each triggered factor adds to the score, by impact. Exported so the
// widget can show the per-factor contribution without re-deriving the weights.
export const RISK_POINTS: Record<RiskFactor["impact"], number> = { high: 40, medium: 20, low: 10 };

export type RiskInput = {
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  escalatedTaskCount: number;
  overdueTaskCount: number;
  daysSinceLastActivity: number | null;
  daysStuckOnMilestone: number | null;
  // Critique #15: the file is simply parked waiting on the deposit transfer
  // (step PM24). Nobody's expecting the deposit until the chain's ready, and
  // once it is the agents know — so the deposit's overdue reminder and the
  // "no recent step completed" clock aren't real risk. When true they're
  // dropped from the score and a plain status line is shown instead.
  awaitingDeposit?: boolean;
  // Whether the file is in a chain (chainLinkId set). Only changes the wording
  // of the deposit status line.
  inChain?: boolean;
  // The sale has exchanged contracts (exchangedAt set / VM19+PM26 done). Exchange
  // is the finish line every file is racing to — a pace/fall-through score past
  // that point is meaningless and reads as alarming, so when true the score is
  // skipped entirely and a calm "Exchanged" state is returned (critique 2026-10-02).
  exchanged?: boolean;
};

// Labels dropped from the score + the visible list when awaitingDeposit — all
// three are really just "waiting on the deposit".
const DEPOSIT_SUPPRESSED = new Set(["Overdue reminder", "Multiple overdue reminders", "No recent step completed"]);

export function calculateRiskScore(input: RiskInput): RiskScore {
  const { onTrack, escalatedTaskCount, overdueTaskCount, daysSinceLastActivity, daysStuckOnMilestone } = input;

  // Exchanged: contracts are exchanged, the sale is legally committed — the
  // finish line every file races to. A fall-through score past that point is
  // meaningless, so return a calm "Exchanged" state instead of a pace score
  // (critique 2026-10-02). Checked first so it wins over every other signal.
  if (input.exchanged === true) {
    return { level: "exchanged", score: 0, factors: [] };
  }

  // On hold: risk factors aren't accumulating (clock is frozen), so showing
  // a score would be misleading. Render the no_data state.
  if (onTrack === "on_hold") {
    return { level: "no_data", score: 0, factors: [] };
  }

  const isNoData =
    escalatedTaskCount === 0 &&
    overdueTaskCount === 0 &&
    daysSinceLastActivity === null &&
    daysStuckOnMilestone === null &&
    onTrack === "unknown";

  if (isNoData) {
    return { level: "no_data", score: 0, factors: [] };
  }

  const factors: RiskFactor[] = [
    {
      label: "Escalated chases",
      detail: escalatedTaskCount > 0
        ? `${escalatedTaskCount} reminder${escalatedTaskCount > 1 ? "s" : ""} escalated after repeated chases went unanswered`
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
      label: "Multiple overdue reminders",
      detail: overdueTaskCount >= 2
        ? `${overdueTaskCount} overdue chase reminders, the other side is not responding`
        : overdueTaskCount === 1
        ? "1 overdue chase reminder"
        : "No overdue reminders",
      triggered: overdueTaskCount >= 2,
      impact: "medium",
    },
    {
      label: "Slow progress pace",
      detail: onTrack === "at_risk"
        ? "Progress is slightly behind the 12-week exchange target"
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
      label: "Overdue reminder",
      detail: overdueTaskCount === 1 ? "1 chase reminder is overdue" : "No overdue reminders",
      triggered: overdueTaskCount === 1,
      impact: "low",
    },
    {
      label: "No recent step completed",
      detail: daysStuckOnMilestone !== null
        ? `No step completed in ${daysStuckOnMilestone} day${daysStuckOnMilestone !== 1 ? "s" : ""}`
        : "Progress data unavailable",
      triggered: daysStuckOnMilestone !== null && daysStuckOnMilestone >= 14,
      impact: "low",
    },
  ];

  // Critique #15: parked on the deposit — un-trigger the deposit-driven signals
  // so they stop feeding the score, and prepare a plain status line instead.
  const awaitingDeposit = input.awaitingDeposit === true;
  if (awaitingDeposit) {
    for (const f of factors) if (DEPOSIT_SUPPRESSED.has(f.label)) f.triggered = false;
  }

  const POINTS: Record<RiskFactor["impact"], number> = { high: 40, medium: 20, low: 10 };
  const score = Math.min(100, factors.filter((f) => f.triggered).reduce((s, f) => s + POINTS[f.impact], 0));
  const level: RiskLevel = score >= 55 ? "high" : score >= 20 ? "medium" : "low";

  // Only expose unique factors (hide "single overdue" if "multiple overdue"
  // triggered), and drop the deposit-suppressed factors entirely when parked.
  const visible = factors.filter((f) => {
    if (f.label === "Overdue reminder" && overdueTaskCount >= 2) return false;
    if (f.label === "Slow progress pace" && onTrack === "off_track") return false;
    if (awaitingDeposit && DEPOSIT_SUPPRESSED.has(f.label)) return false;
    return true;
  });

  const note = awaitingDeposit
    ? (input.inChain ? "Waiting on chain before deposit transfer" : "Waiting on deposit transfer")
    : undefined;

  return { level, score, factors: visible, note };
}

export const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low:     { label: "On track",    color: "text-emerald-700",    bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-400" },
  medium:  { label: "Watch",       color: "text-amber-700",      bg: "bg-amber-50",    border: "border-amber-200",   dot: "bg-amber-400" },
  high:    { label: "At risk",     color: "text-red-700",        bg: "bg-red-50",      border: "border-red-200",     dot: "bg-red-500" },
  no_data: { label: "No data yet", color: "text-slate-500",      bg: "bg-slate-50",    border: "border-slate-200",   dot: "bg-slate-300" },
  // Exchanged — a calm, settled green. The sale is over the line; this is good
  // news, not a risk band (critique 2026-10-02).
  exchanged: { label: "Exchanged", color: "text-emerald-700",   bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-500" },
};
