// Shared derivation of the RiskInput that feeds calculateRiskScore (lib/services/risk.ts).
//
// Data Optionality capture-now, PR5. The nightly risk-history sweep must compute
// risk from EXACTLY the same inputs the product renders, or the history would
// drift from what users saw. This function is a faithful, self-contained
// replication of the inline derivation in lib/services/transactions.ts
// (listTransactions, the `health` object) plus the daysSinceLastActivity that the
// UI computes at its call sites (e.g. components/.../RiskBadgeWithPopover.tsx).
//
// It is a REPLICATION rather than a shared consumer because honouring the
// "no UI changes" rule means the component-side daysSinceLastActivity cannot be
// refactored to import from here. Parity with the render path is locked by
// __tests__/risk/risk-input-parity.test.ts. If the render-path formula changes,
// update both and the parity test will flag the drift.

import { activeElapsedMs } from "@/lib/services/hold-duration";
import type { RiskInput } from "@/lib/services/risk";
import type { TransactionStatus } from "@prisma/client";

const DAY_MS = 86_400_000;

export type RiskInputTx = {
  status: TransactionStatus;
  createdAt: Date;
  lastActivityAt: Date | null;
  // Overdue/escalated are derived from the file's chase tasks.
  chaseTasks: { dueDate: Date; priority: string }[];
  // Completed milestones only (state === "complete"), newest first is not required —
  // we take the max completedAt ourselves.
  completedMilestoneDates: (Date | null)[];
  completedCount: number;
  holdPeriods: { startedAt: Date; endedAt: Date | null }[];
  activeRoundCreatedAt: Date | null;
};

/**
 * Derive the five RiskInput signals for a transaction at time `now`.
 * Mirrors lib/services/transactions.ts:125-220 exactly.
 */
export function deriveRiskInput(tx: RiskInputTx, totalMilestones: number, now: Date = new Date()): RiskInput {
  const nowMs = now.getTime();

  const overdueCount = tx.chaseTasks.filter((t) => new Date(t.dueDate).getTime() < nowMs).length;
  const escalatedCount = tx.chaseTasks.filter(
    (t) => new Date(t.dueDate).getTime() < nowMs && t.priority === "escalated",
  ).length;

  // lastMilestoneAt = latest completedAt among completed milestones.
  const completedTimes = tx.completedMilestoneDates
    .filter((d): d is Date => !!d)
    .map((d) => new Date(d).getTime());
  const lastMilestoneAt = completedTimes.length ? Math.max(...completedTimes) : null;

  // daysStuckOnMilestone: frozen on hold; clamped forward to the active round's
  // createdAt (a relist is progress).
  const stuckRef =
    lastMilestoneAt !== null && tx.activeRoundCreatedAt
      ? Math.max(lastMilestoneAt, tx.activeRoundCreatedAt.getTime())
      : lastMilestoneAt;
  const daysStuckOnMilestone =
    stuckRef !== null && tx.status !== "on_hold"
      ? Math.floor((nowMs - stuckRef) / DAY_MS)
      : null;

  // onTrack: hold-adjusted elapsed vs a 12-week expectation.
  const elapsedAnchor = tx.activeRoundCreatedAt ?? tx.createdAt;
  const daysElapsed =
    activeElapsedMs(new Date(elapsedAnchor), { status: tx.status, holdPeriods: tx.holdPeriods }, now) / DAY_MS;
  const weeksElapsed = daysElapsed / 7;
  const actualPercent = Math.min(100, (tx.completedCount / totalMilestones) * 100);
  const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
  const diff = actualPercent - expectedPercent;
  const onTrack: RiskInput["onTrack"] =
    tx.status === "on_hold"
      ? "on_hold"
      : tx.completedCount === 0
        ? "unknown"
        : diff >= -10
          ? "on_track"
          : diff >= -25
            ? "at_risk"
            : "off_track";

  // daysSinceLastActivity: computed by the UI from lastActivityAt (frozen null
  // when there's no activity timestamp).
  const daysSinceLastActivity = tx.lastActivityAt
    ? Math.floor((nowMs - new Date(tx.lastActivityAt).getTime()) / DAY_MS)
    : null;

  return {
    onTrack,
    escalatedTaskCount: escalatedCount,
    overdueTaskCount: overdueCount,
    daysSinceLastActivity,
    daysStuckOnMilestone,
  };
}
