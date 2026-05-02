// Signal detection orchestrator.
// Calls each detector in sequence (failure of one does not abort others).
// Deduplicates on detectorName + windowStart + dedupeKey so re-runs are safe.

import { prisma } from "@/lib/prisma";
import type { TimeWindow } from "./types";
import { metricDelta } from "./detectors/metric-delta";
import { funnelDrop } from "./detectors/funnel-drop";
import { cohortPattern } from "./detectors/cohort-pattern";
import { sourcePerformance } from "./detectors/source-performance";
import { silentAgency } from "./detectors/silent-agency";
import { powerUserPattern } from "./detectors/power-user-pattern";
import { aiQualityDrift } from "./detectors/ai-quality-drift";
import { costDrift } from "./detectors/cost-drift";
import { posthogRageClick } from "./detectors/posthog-rage-click";
import { posthogFunnelAbandonment } from "./detectors/posthog-funnel-abandonment";
import { posthogSessionFriction } from "./detectors/posthog-session-friction";

const DETECTORS = [
  metricDelta,
  funnelDrop,
  cohortPattern,
  sourcePerformance,
  silentAgency,
  powerUserPattern,
  aiQualityDrift,
  costDrift,
  posthogRageClick,
  posthogFunnelAbandonment,
  posthogSessionFriction,
];

/** Build a standard 7d/7d window anchored at `now` */
export function buildWeeklyWindow(now: Date = new Date()): TimeWindow {
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - 7);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - 7);

  return {
    current: { start: currentStart, end: currentEnd, days: 7 },
    previous: { start: previousStart, end: previousEnd, days: 7 },
  };
}

export async function runAllDetectors(
  window: TimeWindow
): Promise<{ signalsEmitted: number; errors: number }> {
  let signalsEmitted = 0;
  let errors = 0;

  for (const detector of DETECTORS) {
    try {
      const results = await detector(window);

      for (const result of results) {
        // Deduplication: skip if signal with same key already exists for this window
        const alreadyExists = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Signal"
          WHERE "detectorName" = ${result.detectorName}
          AND "windowStart" = ${result.windowStart}
          AND payload->>'dedupeKey' = ${result.dedupeKey}
          LIMIT 1
        `;

        if (alreadyExists.length > 0) continue;

        await prisma.signal.create({
          data: {
            detectorName: result.detectorName,
            payload: { ...result.payload, dedupeKey: result.dedupeKey },
            confidence: result.confidence,
            severity: result.severity,
            windowStart: result.windowStart,
            windowEnd: result.windowEnd,
          },
        });

        signalsEmitted++;
      }
    } catch (err) {
      console.error(`[signals] Detector failed:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return { signalsEmitted, errors };
}
