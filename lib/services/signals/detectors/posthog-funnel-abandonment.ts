// Detector: posthog_funnel_abandonment
// Checks PostHog funnel conversion rates for the onboarding flow:
//   signup_started → signup_completed → transaction_created → milestone_progressed
// Fires when any step drops below DROP_THRESHOLD vs the previous window.
// Requires POSTHOG_API_KEY + POSTHOG_PROJECT_ID; returns [] when not configured.

import type { Detector, SignalResult } from "../types";

const DROP_THRESHOLD = 0.15;  // 15pp drop triggers signal
const MIN_STEP_ENTRIES = 20;  // min events at step 1 to be meaningful

const FUNNEL_STEPS = [
  "signup_started",
  "signup_completed",
  "transaction_created",
  "milestone_progressed",
];

type FunnelRates = {
  step: string;
  nextStep: string;
  currentRate: number;
  previousRate: number;
  currentCount: number;
  previousCount: number;
};

async function getFunnelStepCounts(
  events: string[],
  start: Date,
  end: Date,
  apiKey: string,
  projectId: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  await Promise.all(
    events.map(async (event) => {
      const params = new URLSearchParams({
        after: start.toISOString(),
        before: end.toISOString(),
        event,
        limit: "1",
      });

      try {
        const res = await fetch(
          `https://eu.posthog.com/api/projects/${projectId}/events/?${params}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10_000),
          }
        );

        if (!res.ok) return;
        const data = await res.json() as { count?: number };
        counts.set(event, typeof data.count === "number" ? data.count : 0);
      } catch {
        // leave absent from map — will be treated as 0
      }
    })
  );

  return counts;
}

export const posthogFunnelAbandonment: Detector = async (window) => {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn("[posthog_funnel_abandonment] POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set — skipping");
    return [];
  }

  let currentCounts: Map<string, number>;
  let previousCounts: Map<string, number>;

  try {
    [currentCounts, previousCounts] = await Promise.all([
      getFunnelStepCounts(FUNNEL_STEPS, window.current.start, window.current.end, apiKey, projectId),
      getFunnelStepCounts(FUNNEL_STEPS, window.previous.start, window.previous.end, apiKey, projectId),
    ]);
  } catch (err) {
    console.warn("[posthog_funnel_abandonment] fetch error:", err);
    return [];
  }

  const topStepPrevious = previousCounts.get(FUNNEL_STEPS[0]) ?? 0;
  if (topStepPrevious < MIN_STEP_ENTRIES) return [];

  const drops: FunnelRates[] = [];

  for (let i = 0; i < FUNNEL_STEPS.length - 1; i++) {
    const step = FUNNEL_STEPS[i];
    const nextStep = FUNNEL_STEPS[i + 1];

    const curStep = currentCounts.get(step) ?? 0;
    const curNext = currentCounts.get(nextStep) ?? 0;
    const prevStep = previousCounts.get(step) ?? 0;
    const prevNext = previousCounts.get(nextStep) ?? 0;

    if (curStep === 0 || prevStep === 0) continue;

    const currentRate = curNext / curStep;
    const previousRate = prevNext / prevStep;
    const delta = previousRate - currentRate;

    if (delta >= DROP_THRESHOLD) {
      drops.push({ step, nextStep, currentRate, previousRate, currentCount: curStep, previousCount: prevStep });
    }
  }

  return drops.map((drop) => ({
    detectorName: "posthog_funnel_abandonment",
    dedupeKey: `posthog_funnel_abandonment:${drop.step}_to_${drop.nextStep}`,
    payload: {
      step: drop.step,
      nextStep: drop.nextStep,
      currentConversionRate: Math.round(drop.currentRate * 100),
      previousConversionRate: Math.round(drop.previousRate * 100),
      dropPP: Math.round((drop.previousRate - drop.currentRate) * 100),
      currentStepCount: drop.currentCount,
      previousStepCount: drop.previousCount,
    },
    confidence: Math.min(
      0.35 + (drop.previousCount / 100) * 0.35 + ((drop.previousRate - drop.currentRate) / 0.3) * 0.30,
      0.90
    ),
    severity: (drop.previousRate - drop.currentRate) >= 0.30 ? "critical" : "leak",
    windowStart: window.current.start,
    windowEnd: window.current.end,
  }));
};
