// Signal detection orchestrator.
//
// Living signals: one row per ongoing SITUATION (detectorName + dedupeKey), not
// one row per nightly run. Each run that still sees a situation refreshes the
// existing live row (payload/confidence/severity, lastSeenAt, occurrences++).
// A situation a detector no longer reports is auto-resolved (resolvedAt stamped)
// so the feed clears itself instead of piling up duplicates forever.

import { prisma } from "@/lib/prisma";
import type { Detector, TimeWindow } from "./types";
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
import { contentPerformance } from "./detectors/content-performance";
import { revenueAtRisk } from "./detectors/revenue-at-risk";
import { portalGoneQuiet } from "./detectors/portal-gone-quiet";
import { chaseNotLanding } from "./detectors/chase-not-landing";
import { quoteInboxAging } from "./detectors/quote-inbox-aging";
import { solicitorConfirmPending } from "./detectors/solicitor-confirm-pending";

// Each detector registers with the stable name it emits so we can auto-resolve
// its live signals even on a run where it returns nothing.
type RegisteredDetector = { name: string; run: Detector };

const DETECTORS: RegisteredDetector[] = [
  { name: "metric_delta", run: metricDelta },
  { name: "funnel_drop", run: funnelDrop },
  { name: "cohort_pattern", run: cohortPattern },
  { name: "source_performance", run: sourcePerformance },
  { name: "silent_agency", run: silentAgency },
  { name: "power_user_pattern", run: powerUserPattern },
  { name: "ai_quality_drift", run: aiQualityDrift },
  { name: "cost_drift", run: costDrift },
  { name: "posthog_rage_click", run: posthogRageClick },
  { name: "posthog_funnel_abandonment", run: posthogFunnelAbandonment },
  { name: "posthog_session_friction", run: posthogSessionFriction },
  { name: "content_performance", run: contentPerformance },
  { name: "revenue_at_risk", run: revenueAtRisk },
  { name: "portal_gone_quiet", run: portalGoneQuiet },
  { name: "chase_not_landing", run: chaseNotLanding },
  { name: "quote_inbox_aging", run: quoteInboxAging },
  { name: "solicitor_confirm_pending", run: solicitorConfirmPending },
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
): Promise<{ signalsEmitted: number; signalsUpdated: number; signalsResolved: number; errors: number }> {
  let signalsEmitted = 0;
  let signalsUpdated = 0;
  let signalsResolved = 0;
  let errors = 0;

  const now = new Date();

  for (const detector of DETECTORS) {
    try {
      const results = await detector.run(window);
      const seenKeys: string[] = [];

      for (const result of results) {
        const dedupeKey = result.dedupeKey;
        seenKeys.push(dedupeKey);

        // Is this situation already live (unresolved) under the same identity?
        const existing = await prisma.signal.findFirst({
          where: { detectorName: detector.name, dedupeKey, resolvedAt: null },
          orderBy: { detectedAt: "desc" },
          select: { id: true, occurrences: true, snoozedUntil: true },
        });

        if (existing) {
          // Refresh the live signal. Re-arm snooze if the situation persists
          // past the snooze window so it can resurface.
          const clearSnooze =
            existing.snoozedUntil && existing.snoozedUntil < now ? { snoozedUntil: null } : {};
          await prisma.signal.update({
            where: { id: existing.id },
            data: {
              payload: { ...result.payload, dedupeKey },
              confidence: result.confidence,
              severity: result.severity,
              windowStart: result.windowStart,
              windowEnd: result.windowEnd,
              lastSeenAt: now,
              occurrences: existing.occurrences + 1,
              ...clearSnooze,
            },
          });
          signalsUpdated++;
        } else {
          await prisma.signal.create({
            data: {
              detectorName: result.detectorName,
              dedupeKey,
              payload: { ...result.payload, dedupeKey },
              confidence: result.confidence,
              severity: result.severity,
              windowStart: result.windowStart,
              windowEnd: result.windowEnd,
              lastSeenAt: now,
            },
          });
          signalsEmitted++;
        }
      }

      // Auto-resolve: any live signal for THIS detector the run no longer sees.
      // Only runs when the detector completed without throwing (below), so an
      // errored detector never falsely clears its situations.
      const resolved = await prisma.signal.updateMany({
        where: {
          detectorName: detector.name,
          resolvedAt: null,
          ...(seenKeys.length > 0 ? { dedupeKey: { notIn: seenKeys } } : {}),
        },
        data: { resolvedAt: now },
      });
      signalsResolved += resolved.count;
    } catch (err) {
      console.error(`[signals] Detector ${detector.name} failed:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return { signalsEmitted, signalsUpdated, signalsResolved, errors };
}
