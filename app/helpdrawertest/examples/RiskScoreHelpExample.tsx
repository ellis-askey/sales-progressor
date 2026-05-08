"use client";

import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import type { RiskInput } from "@/lib/services/risk";

// Watch state: file behind pace + no recent activity. Score = 40, level = "medium".
const WATCH_INPUT: RiskInput = {
  onTrack: "at_risk",
  escalatedTaskCount: 0,
  overdueTaskCount: 0,
  daysSinceLastActivity: 25,
  daysStuckOnMilestone: 5,
};

export function RiskScoreHelpExample(_props: Record<string, string>) {
  return <RiskScoreWidget input={WATCH_INPUT} />;
}
