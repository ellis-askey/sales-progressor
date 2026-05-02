// Detector: cost_drift
// Two sub-signals:
//   1. AI spend: compares OutboundMessage AI generation cost week-over-week.
//      Fires on 20%+ increase. Confidence based on message volume.
//   2. PostHog event budget: if daily event count projects to >800k/month,
//      emits a critical Signal (CLARIFICATION 5 from plan approval).
// PostHog check requires POSTHOG_API_KEY + POSTHOG_PROJECT_ID env vars;
// returns [] gracefully when not configured.

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_MESSAGES = 20;
const MIN_COST_DELTA = 0.20;   // 20% increase triggers signal
const POSTHOG_MONTHLY_BUDGET = 800_000;

type SpendStats = {
  count: number;
  totalCostCents: number;
};

async function getSpendStats(start: Date, end: Date): Promise<SpendStats> {
  const messages = await prisma.outboundMessage.findMany({
    where: {
      wasAiGenerated: true,
      createdAt: { gte: start, lt: end },
    },
    select: { aiCostCents: true },
  });

  return {
    count: messages.length,
    totalCostCents: messages.reduce((acc, m) => acc + (m.aiCostCents ?? 0), 0),
  };
}

async function getPostHogDailyEvents(): Promise<number | null> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn("[cost_drift] POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set — skipping PostHog check");
    return null;
  }

  // Query PostHog Trends API for events in the last 7 days
  const dateFrom = new Date();
  dateFrom.setUTCDate(dateFrom.getUTCDate() - 7);

  try {
    const url = `https://eu.posthog.com/api/projects/${projectId}/insights/trend/?events=[{"id":"$pageview","math":"total"}]&date_from=${dateFrom.toISOString().slice(0, 10)}&display=ActionsLineGraph`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[cost_drift] PostHog API returned ${res.status}`);
      return null;
    }

    // Sum all event types in last 7d using the events endpoint
    const eventsUrl = `https://eu.posthog.com/api/projects/${projectId}/events/?after=${dateFrom.toISOString()}&limit=1`;
    const countRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!countRes.ok) return null;
    const countData = await countRes.json() as { count?: number };
    return typeof countData.count === "number" ? countData.count : null;
  } catch (err) {
    console.warn("[cost_drift] PostHog API error:", err);
    return null;
  }
}

export const costDrift: Detector = async (window) => {
  const signals: SignalResult[] = [];

  // --- Sub-signal 1: AI spend drift ---
  const [current, previous] = await Promise.all([
    getSpendStats(window.current.start, window.current.end),
    getSpendStats(window.previous.start, window.previous.end),
  ]);

  if (previous.count >= MIN_MESSAGES && previous.totalCostCents > 0) {
    const delta = (current.totalCostCents - previous.totalCostCents) / previous.totalCostCents;
    if (delta >= MIN_COST_DELTA) {
      const confidence = Math.min(
        0.3 + (previous.count / 100) * 0.4 + (delta / 0.5) * 0.3,
        0.88
      );
      if (confidence >= 0.2) {
        signals.push({
          detectorName: "cost_drift",
          dedupeKey: "cost_drift:ai_spend",
          payload: {
            indicator: "ai_spend_cents",
            currentCents: current.totalCostCents,
            previousCents: previous.totalCostCents,
            deltaPercent: Math.round(delta * 100),
            nMessagesCurrent: current.count,
            nMessagesPrevious: previous.count,
          },
          confidence,
          severity: delta >= 0.5 ? "critical" : "leak",
          windowStart: window.current.start,
          windowEnd: window.current.end,
        });
      }
    }
  }

  // --- Sub-signal 2: PostHog event budget ---
  const sevenDayEvents = await getPostHogDailyEvents();
  if (sevenDayEvents !== null) {
    const avgDaily = sevenDayEvents / 7;
    const projectedMonthly = avgDaily * 30;

    if (projectedMonthly > POSTHOG_MONTHLY_BUDGET) {
      signals.push({
        detectorName: "cost_drift",
        dedupeKey: "cost_drift:posthog_budget",
        payload: {
          indicator: "posthog_event_budget",
          sevenDayTotal: sevenDayEvents,
          avgDailyEvents: Math.round(avgDaily),
          projectedMonthlyEvents: Math.round(projectedMonthly),
          budgetLimit: POSTHOG_MONTHLY_BUDGET,
          overagePercent: Math.round(((projectedMonthly - POSTHOG_MONTHLY_BUDGET) / POSTHOG_MONTHLY_BUDGET) * 100),
        },
        confidence: 1.0,
        severity: "critical",
        windowStart: window.current.start,
        windowEnd: window.current.end,
      });
    }
  }

  return signals;
};
