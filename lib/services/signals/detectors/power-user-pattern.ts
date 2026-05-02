// Detector: power_user_pattern
// Identifies usage shapes that correlate with high retention.
// "Power" = top quartile by events per active-day in last 30d.
// Fires if power users retain at least 15pp better than non-power users.
// Minimum N=15 in the power group required (ADMIN_07 §5.3).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_POWER_GROUP = 15;
const MIN_LIFT_PP = 15;
const LOOKBACK_DAYS = 30;
const RETENTION_CHECK_DAYS = 14;

export const powerUserPattern: Detector = async (window) => {
  const lookbackStart = new Date(window.current.end);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - LOOKBACK_DAYS);

  // Count events per agency in the lookback window
  const eventsByAgency = await prisma.event.groupBy({
    by: ["agencyId"],
    where: {
      occurredAt: { gte: lookbackStart, lt: window.current.end },
      agencyId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  if (eventsByAgency.length < MIN_POWER_GROUP * 2) return [];

  // Top quartile = power users
  const quartileIdx = Math.floor(eventsByAgency.length * 0.25);
  const powerIds = eventsByAgency
    .slice(0, quartileIdx)
    .map((r) => r.agencyId as string);
  const nonPowerIds = eventsByAgency
    .slice(quartileIdx)
    .map((r) => r.agencyId as string);

  if (powerIds.length < MIN_POWER_GROUP) return [];

  // Retention: had any event in the 14 days AFTER the lookback window ends
  const retentionStart = new Date(window.current.end);
  const retentionEnd = new Date(retentionStart);
  retentionEnd.setUTCDate(retentionEnd.getUTCDate() + RETENTION_CHECK_DAYS);

  const retainedPower = await prisma.event.groupBy({
    by: ["agencyId"],
    where: {
      agencyId: { in: powerIds },
      occurredAt: { gte: retentionStart, lt: retentionEnd },
    },
    _count: { id: true },
  });

  const retainedNonPower = await prisma.event.groupBy({
    by: ["agencyId"],
    where: {
      agencyId: { in: nonPowerIds },
      occurredAt: { gte: retentionStart, lt: retentionEnd },
    },
    _count: { id: true },
  });

  // Skip if retention window is in the future (pre-launch)
  if (retentionEnd > new Date()) return [];

  const rateA = powerIds.length > 0 ? retainedPower.length / powerIds.length : 0;
  const rateB = nonPowerIds.length > 0 ? retainedNonPower.length / nonPowerIds.length : 0;
  const liftPP = (rateA - rateB) * 100;

  if (liftPP < MIN_LIFT_PP) return [];

  const confidence = Math.min(
    0.3 + (powerIds.length / 50) * 0.4 + (liftPP / 50) * 0.3,
    0.88
  );

  return [
    {
      detectorName: "power_user_pattern",
      dedupeKey: "power_user_pattern:top_quartile_retention",
      payload: {
        pattern: "top_quartile_event_volume_predicts_retention",
        powerGroup: { n: powerIds.length, retentionRate: Math.round(rateA * 100) },
        nonPowerGroup: { n: nonPowerIds.length, retentionRate: Math.round(rateB * 100) },
        liftPP: Math.round(liftPP),
        lookbackDays: LOOKBACK_DAYS,
        retentionCheckDays: RETENTION_CHECK_DAYS,
        quartileCutoffEvents: eventsByAgency[quartileIdx]?._count.id ?? 0,
      },
      confidence,
      severity: "opportunity",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    },
  ];
};
