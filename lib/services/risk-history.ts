// Nightly, change-only risk-history sweep (Data Optionality capture-now, PR5).
//
// Re-evaluates fall-through risk for every live file using the SAME inputs the
// product renders (deriveRiskInput → calculateRiskScore, both unchanged) and
// appends a TransactionRiskHistory row ONLY when the risk level or the set of
// triggered factors changes. This captures both event-driven changes and
// time-driven ones (a signal silently crossing a day threshold overnight)
// without storing redundant identical daily rows.
//
// Capture-only: nothing reads TransactionRiskHistory, and no risk field is added
// to PropertyTransaction. Per-file failures are logged and skipped — the next
// nightly pass self-heals (a missed change is recorded then, with a slightly
// later timestamp: a documented <=24h latency).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { deriveRiskInput } from "@/lib/services/risk-input";
import { calculateRiskScore, type RiskLevel } from "@/lib/services/risk";

// A file stops accruing risk once it's exchanged or has left the pipeline.
const EXCLUDED_STATUSES = ["draft", "withdrawn", "completed"];

type TriggeredFactor = { label: string; impact: "high" | "medium" | "low" };

/** Stable, order-independent signature of the triggered-factor set. */
function factorSignature(factors: { label: string }[]): string {
  return factors.map((f) => f.label).sort().join("|");
}

type LastRow = { toLevel: string; factors: unknown } | null;

/**
 * True when risk has materially changed vs the last recorded row: no prior row
 * (first evaluation → baseline), a different level, or a different set of
 * triggered factors. Pure + exported for testing.
 */
export function riskChanged(last: LastRow, level: RiskLevel, triggered: TriggeredFactor[]): boolean {
  if (!last) return true;
  if (last.toLevel !== level) return true;
  const prev = Array.isArray(last.factors) ? (last.factors as { label: string }[]) : [];
  return factorSignature(prev) !== factorSignature(triggered);
}

/**
 * Run the change-only risk-history sweep across all live transactions.
 * Returns the number of history rows written.
 */
export async function runRiskHistorySweep(now: Date = new Date()): Promise<number> {
  const totalMilestones = await prisma.milestoneDefinition.count({
    where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
  });
  const retired = new Set<string>([...RETIRED_ENQUIRY_CODES] as string[]);

  const whereClause: Prisma.PropertyTransactionWhereInput = {
    status: { notIn: EXCLUDED_STATUSES as never },
    exchangedAt: null,
  };
  const activeRoundIds = await loadActiveRoundIds(whereClause);

  const txs = await prisma.propertyTransaction.findMany({
    where: whereClause,
    select: {
      id: true,
      status: true,
      createdAt: true,
      lastActivityAt: true,
      activeBuyerRound: { select: { createdAt: true } },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
      // Mirrors listTransactions: completed, round-scoped. lastMilestoneAt uses
      // all completed; completedCount excludes retired enquiry codes.
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(activeRoundIds) },
        select: { completedAt: true, milestoneDefinition: { select: { code: true } } },
      },
      // Mirrors listTransactions: pending, round-scoped, 5 earliest-due.
      chaseTasks: {
        where: { status: "pending", OR: roundScopedOR(activeRoundIds) },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: { dueDate: true, priority: true },
      },
    },
  });

  let written = 0;
  for (const tx of txs) {
    try {
      const completedCount = tx.milestoneCompletions.filter(
        (c) => c.milestoneDefinition?.code && !retired.has(c.milestoneDefinition.code),
      ).length;

      const input = deriveRiskInput(
        {
          status: tx.status,
          createdAt: tx.createdAt,
          lastActivityAt: tx.lastActivityAt,
          chaseTasks: tx.chaseTasks,
          completedMilestoneDates: tx.milestoneCompletions.map((c) => c.completedAt),
          completedCount,
          holdPeriods: tx.holdPeriods,
          activeRoundCreatedAt: tx.activeBuyerRound?.createdAt ?? null,
        },
        totalMilestones,
        now,
      );

      const score = calculateRiskScore(input);
      const triggered: TriggeredFactor[] = score.factors
        .filter((f) => f.triggered)
        .map((f) => ({ label: f.label, impact: f.impact }));

      const last = await prisma.transactionRiskHistory.findFirst({
        where: { transactionId: tx.id },
        orderBy: { occurredAt: "desc" },
        select: { toLevel: true, toScore: true, factors: true },
      });

      if (!riskChanged(last, score.level, triggered)) continue;

      await prisma.transactionRiskHistory.create({
        data: {
          transactionId: tx.id,
          fromLevel: last?.toLevel ?? null,
          toLevel: score.level,
          fromScore: last?.toScore ?? null,
          toScore: score.score,
          factors: triggered as unknown as Prisma.InputJsonValue,
          inputs: input as unknown as Prisma.InputJsonValue,
          source: "nightly",
        },
      });
      written++;
    } catch (err) {
      console.error(`[risk-history] tx ${tx.id}:`, err);
    }
  }
  return written;
}
