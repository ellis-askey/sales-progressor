// Detector: content_performance
// Weekly comparison of content engagement rates by channel.
// Fires when a channel shows >20% lift or drop vs the previous window, with n>=5 posts in both windows.

import { commandDb } from "@/lib/command/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_SAMPLE = 5;
const LIFT_THRESHOLD = 0.20; // 20% change required

function totalEngagement(e: { likes: number; comments: number; shares: number }): number {
  return e.likes + e.comments * 2 + e.shares * 3;
}

function avg(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export const contentPerformance: Detector = async (window) => {
  const results: SignalResult[] = [];

  const [currentRecords, previousRecords] = await Promise.all([
    commandDb.contentEngagement.findMany({
      where: { createdAt: { gte: window.current.start, lt: window.current.end } },
      select: { channel: true, likes: true, comments: true, shares: true },
    }),
    commandDb.contentEngagement.findMany({
      where: { createdAt: { gte: window.previous.start, lt: window.previous.end } },
      select: { channel: true, likes: true, comments: true, shares: true },
    }),
  ]);

  // Group by channel
  const channels = Array.from(
    new Set([
      ...currentRecords.map((r) => r.channel),
      ...previousRecords.map((r) => r.channel),
    ])
  );

  for (const channel of channels) {
    const currentVals = currentRecords
      .filter((r) => r.channel === channel)
      .map(totalEngagement);
    const previousVals = previousRecords
      .filter((r) => r.channel === channel)
      .map(totalEngagement);

    if (currentVals.length < MIN_SAMPLE || previousVals.length < MIN_SAMPLE) continue;

    const currentAvg = avg(currentVals);
    const previousAvg = avg(previousVals);

    if (previousAvg === 0) continue;

    const lift = (currentAvg - previousAvg) / previousAvg;

    if (Math.abs(lift) < LIFT_THRESHOLD) continue;

    const isUp = lift > 0;
    const pctStr = `${Math.round(Math.abs(lift) * 100)}%`;
    const dedupeKey = `${channel}:${isUp ? "up" : "down"}`;

    results.push({
      detectorName: "content_performance",
      dedupeKey,
      severity: isUp ? "opportunity" : "leak",
      confidence: Math.min(0.95, 0.5 + Math.abs(lift) * 1.5),
      windowStart: window.current.start,
      windowEnd: window.current.end,
      payload: {
        channel,
        direction: isUp ? "up" : "down",
        liftPercent: Math.round(lift * 100),
        currentAvgScore: Math.round(currentAvg * 10) / 10,
        previousAvgScore: Math.round(previousAvg * 10) / 10,
        currentN: currentVals.length,
        previousN: previousVals.length,
        summary: isUp
          ? `${channel} content is outperforming baseline by ${pctStr} (avg score ${Math.round(currentAvg)} vs ${Math.round(previousAvg)})`
          : `${channel} content engagement dropped ${pctStr} vs prior week (avg ${Math.round(currentAvg)} vs ${Math.round(previousAvg)})`,
      },
    });
  }

  return results;
};
