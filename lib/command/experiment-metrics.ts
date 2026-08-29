import { prisma } from "@/lib/prisma";
import type { MetricKey } from "@/lib/command/experiment-metric-defs";

// Live computation of the Growth-tests metric vocabulary (defined in
// experiment-metric-defs.ts). Platform metrics come from the nightly
// DailyMetric grand-total row (already excludes internal/demo); feature metrics
// are counted live over the window, excluding internal/test/demo files.

export type { MetricKey } from "@/lib/command/experiment-metric-defs";
export { METRIC_DEFS, METRIC_KEYS } from "@/lib/command/experiment-metric-defs";

// Non-demo, non-internal filter reused across the feature counts.
const realFile = { isDemo: false, agency: { isInternal: false } } as const;

// Compute every metric over [windowStart, windowEnd]. Used by the experiment
// snapshot (baseline/result) and available to the suggestion engine.
export async function computeExperimentMetrics(
  windowStart: Date,
  windowEnd: Date,
): Promise<Record<MetricKey, number>> {
  const dateRange = { gte: windowStart, lte: windowEnd };

  const [daily, followupTaps, quoteRequests, pushOptins, portalMessages, clientConfirms, portalDocs] =
    await Promise.all([
      prisma.dailyMetric.findMany({
        where: { agencyId: null, serviceType: null, modeProfile: null, date: dateRange },
        select: {
          signups: true,
          uniqueActiveUsers: true,
          transactionsCreated: true,
          milestonesConfirmed: true,
          chasesSent: true,
          aiDraftsGenerated: true,
          aiSpendCents: true,
        },
      }),
      prisma.followupTap.count({ where: { tappedAt: dateRange, transaction: realFile } }),
      prisma.quoteRequest.count({ where: { submittedAt: dateRange, transaction: realFile } }),
      prisma.portalPushSubscription.count({ where: { createdAt: dateRange, contact: { transaction: realFile } } }),
      prisma.portalMessage.count({ where: { createdAt: dateRange, fromClient: true, transaction: realFile } }),
      prisma.milestoneCompletion.count({ where: { completedAt: dateRange, confirmedByPortal: true, transaction: realFile } }),
      prisma.transactionDocument.count({ where: { createdAt: dateRange, source: "portal", transaction: realFile } }),
    ]);

  const sum = (k: "signups" | "uniqueActiveUsers" | "transactionsCreated" | "milestonesConfirmed" | "chasesSent" | "aiDraftsGenerated" | "aiSpendCents") =>
    daily.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
  const days = daily.length || 1;

  return {
    signups: sum("signups"),
    uniqueActiveUsersAvg: Math.round((sum("uniqueActiveUsers") / days) * 10) / 10,
    transactionsCreated: sum("transactionsCreated"),
    milestonesConfirmed: sum("milestonesConfirmed"),
    chasesSent: sum("chasesSent"),
    aiDraftsGenerated: sum("aiDraftsGenerated"),
    aiSpendCents: sum("aiSpendCents"),
    followupTaps,
    quoteRequests,
    pushOptins,
    portalMessages,
    clientConfirms,
    portalDocsUploaded: portalDocs,
  };
}
