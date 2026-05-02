// Detector: metric_delta
// Week-over-week change in global DailyMetric values.
// Fires once per metric that moved more than 10% with a non-trivial baseline.
// Confidence is based on sample size and effect size (ADMIN_07 §5.1).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";
import type { SignalSeverity } from "@prisma/client";

type MetricSums = {
  transactionsCreated: number;
  transactionsExchanged: number;
  transactionsCompleted: number;
  milestonesConfirmed: number;
  chasesSent: number;
  aiDraftsGenerated: number;
  signups: number;
  logins: number;
  aiSpendCents: number;
};

type MetricConfig = {
  field: keyof MetricSums;
  label: string;
  // Whether an increase in this metric is positive, negative, or ambiguous
  positiveIs: "good" | "bad" | "neutral";
  // Minimum absolute value in the previous window to fire
  minBaseline: number;
};

const METRICS: MetricConfig[] = [
  { field: "transactionsCreated", label: "new transactions", positiveIs: "good", minBaseline: 1 },
  { field: "transactionsExchanged", label: "exchanges", positiveIs: "good", minBaseline: 1 },
  { field: "transactionsCompleted", label: "completions", positiveIs: "good", minBaseline: 1 },
  { field: "milestonesConfirmed", label: "milestones confirmed", positiveIs: "good", minBaseline: 5 },
  { field: "chasesSent", label: "chases sent", positiveIs: "neutral", minBaseline: 5 },
  { field: "aiDraftsGenerated", label: "AI drafts generated", positiveIs: "neutral", minBaseline: 5 },
  { field: "signups", label: "new agency signups", positiveIs: "good", minBaseline: 1 },
  { field: "logins", label: "logins", positiveIs: "neutral", minBaseline: 10 },
  { field: "aiSpendCents", label: "AI spend", positiveIs: "bad", minBaseline: 100 },
];

async function getWeeklySums(start: Date, end: Date): Promise<MetricSums> {
  const result = await prisma.dailyMetric.aggregate({
    where: {
      date: { gte: start, lt: end },
      agencyId: null,
      serviceType: null,
      modeProfile: null,
    },
    _sum: {
      transactionsCreated: true,
      transactionsExchanged: true,
      transactionsCompleted: true,
      milestonesConfirmed: true,
      chasesSent: true,
      aiDraftsGenerated: true,
      signups: true,
      logins: true,
      aiSpendCents: true,
    },
  });

  const s = result._sum;
  return {
    transactionsCreated: s.transactionsCreated ?? 0,
    transactionsExchanged: s.transactionsExchanged ?? 0,
    transactionsCompleted: s.transactionsCompleted ?? 0,
    milestonesConfirmed: s.milestonesConfirmed ?? 0,
    chasesSent: s.chasesSent ?? 0,
    aiDraftsGenerated: s.aiDraftsGenerated ?? 0,
    signups: s.signups ?? 0,
    logins: s.logins ?? 0,
    aiSpendCents: s.aiSpendCents ?? 0,
  };
}

function computeConfidence(previous: number, deltaMagnitude: number): number {
  // Sample-size component
  const sampleScore =
    previous < 5 ? 0.1 :
    previous < 20 ? 0.3 :
    previous < 50 ? 0.5 :
    previous < 200 ? 0.65 : 0.8;

  // Effect-size component
  const effectScore = Math.min(deltaMagnitude * 1.5, 0.9);

  return Math.min(sampleScore * 0.6 + effectScore * 0.4, 0.95);
}

function computeSeverity(delta: number, positiveIs: MetricConfig["positiveIs"], confidence: number): SignalSeverity {
  if (positiveIs === "neutral") return "info";
  const isNegative = (positiveIs === "good" && delta < 0) || (positiveIs === "bad" && delta > 0);
  if (isNegative) return confidence >= 0.6 ? "leak" : "info";
  return "opportunity";
}

export const metricDelta: Detector = async (window) => {
  const [current, previous] = await Promise.all([
    getWeeklySums(window.current.start, window.current.end),
    getWeeklySums(window.previous.start, window.previous.end),
  ]);

  // If both windows are zero across the board, we have no data yet — skip
  const totalPrevious = Object.values(previous).reduce((a, b) => a + b, 0);
  if (totalPrevious === 0) return [];

  const signals: SignalResult[] = [];

  for (const metric of METRICS) {
    const curr = current[metric.field];
    const prev = previous[metric.field];

    if (prev < metric.minBaseline) continue;

    const delta = (curr - prev) / prev;
    const deltaMagnitude = Math.abs(delta);
    if (deltaMagnitude < 0.10) continue; // less than 10% change — not interesting

    const confidence = computeConfidence(prev, deltaMagnitude);
    if (confidence < 0.2) continue; // suppressed per ADMIN_07 §5.2

    const severity = computeSeverity(delta, metric.positiveIs, confidence);

    signals.push({
      detectorName: "metric_delta",
      dedupeKey: `metric_delta:${metric.field}`,
      payload: {
        metric: metric.field,
        label: metric.label,
        current: curr,
        previous: prev,
        delta: Math.round(delta * 1000) / 1000,
        deltaPercent: Math.round(delta * 100),
        windowCurrentDays: window.current.days,
        windowPreviousDays: window.previous.days,
      },
      confidence,
      severity,
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  return signals;
};
