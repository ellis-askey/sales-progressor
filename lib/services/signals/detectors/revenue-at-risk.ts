// Detector: revenue_at_risk
// Two money-adjacent situations on real customer files:
//   A) UNBILLED EXCHANGE — a file has exchanged (the billable event) but has no
//      agent fee recorded, so we can't invoice it. Fact, high stakes.
//   B) STALLED BEFORE EXCHANGE — a file reached "ready to exchange" (VM18/PM25)
//      but hasn't exchanged and hasn't moved for STALLED_DAYS. Revenue delayed
//      or at risk of falling through right before the payday.

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const STALLED_DAYS = 14;
const UNBILLED_LOOKBACK_DAYS = 90;

export const revenueAtRisk: Detector = async (window) => {
  const now = window.current.end;
  const stalledCutoff = new Date(now.getTime() - STALLED_DAYS * 86_400_000);
  const unbilledSince = new Date(now.getTime() - UNBILLED_LOOKBACK_DAYS * 86_400_000);

  const signals: SignalResult[] = [];

  // A) Exchanged but no fee captured — uncaptured revenue we still can invoice.
  const unbilled = await prisma.propertyTransaction.findMany({
    where: {
      exchangedAt: { not: null, gte: unbilledSince },
      status: { in: ["active", "completed"] },
      agentFeeAmount: null,
      agentFeePercent: null,
      isDemo: false,
      isMigrated: false,
      agency: { isInternal: false },
    },
    select: { id: true, propertyAddress: true, exchangedAt: true, agency: { select: { name: true } } },
    take: 100,
  });

  for (const t of unbilled) {
    const daysSince = Math.floor((now.getTime() - (t.exchangedAt as Date).getTime()) / 86_400_000);
    signals.push({
      detectorName: "revenue_at_risk",
      dedupeKey: `revenue_at_risk:unbilled:${t.id}`,
      payload: {
        kind: "unbilled_exchange",
        transactionId: t.id,
        address: t.propertyAddress,
        agencyName: t.agency?.name ?? null,
        exchangedDaysAgo: daysSince,
      },
      confidence: 1.0,
      severity: "critical",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  // B) Ready to exchange but stalled — no VM19/PM26 yet and no movement.
  const stalled = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      milestoneDefinition: { code: { in: ["VM18", "PM25"] } },
      completedAt: { lt: stalledCutoff },
      transaction: {
        status: "active",
        exchangedAt: null,
        isDemo: false,
        isMigrated: false,
        agency: { isInternal: false },
        milestoneCompletions: {
          none: { state: "complete", milestoneDefinition: { code: { in: ["VM19", "PM26"] } } },
        },
      },
    },
    orderBy: { completedAt: "asc" },
    distinct: ["transactionId"],
    take: 100,
    select: {
      transactionId: true,
      completedAt: true,
      transaction: { select: { propertyAddress: true, agency: { select: { name: true } } } },
    },
  });

  for (const m of stalled) {
    const daysStalled = Math.floor((now.getTime() - (m.completedAt as Date).getTime()) / 86_400_000);
    signals.push({
      detectorName: "revenue_at_risk",
      dedupeKey: `revenue_at_risk:stalled:${m.transactionId}`,
      payload: {
        kind: "stalled_before_exchange",
        transactionId: m.transactionId,
        address: m.transaction.propertyAddress,
        agencyName: m.transaction.agency?.name ?? null,
        daysStalled,
      },
      confidence: 0.8,
      severity: "leak",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  return signals;
};
