// Detector: posthog_rage_click
// Queries PostHog for rage-click events in the current window.
// Fires when any page/selector exceeds RAGE_CLICK_THRESHOLD in the window.
// Requires POSTHOG_API_KEY + POSTHOG_PROJECT_ID; returns [] when not configured.

import type { Detector, SignalResult } from "../types";

const RAGE_CLICK_THRESHOLD = 50;  // min rage-click events on a target to fire

type RageClickEntry = {
  element: string;
  page: string;
  count: number;
};

async function fetchRageClicks(
  start: Date,
  end: Date,
  apiKey: string,
  projectId: string
): Promise<RageClickEntry[]> {
  const params = new URLSearchParams({
    after: start.toISOString(),
    before: end.toISOString(),
    event: "$rageclick",
    limit: "1000",
  });

  const res = await fetch(
    `https://eu.posthog.com/api/projects/${projectId}/events/?${params}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) {
    console.warn(`[posthog_rage_click] PostHog API returned ${res.status}`);
    return [];
  }

  const data = await res.json() as { results?: Array<{ properties?: Record<string, unknown> }> };
  if (!data.results) return [];

  // Aggregate by element selector + current URL
  const counts = new Map<string, { element: string; page: string; count: number }>();
  for (const event of data.results) {
    const props = event.properties ?? {};
    const element = String(props["$el_text"] ?? props["$selector"] ?? "unknown");
    const page = String(props["$current_url"] ?? "unknown");
    const key = `${page}::${element}`;
    const existing = counts.get(key) ?? { element, page, count: 0 };
    existing.count++;
    counts.set(key, existing);
  }

  return Array.from(counts.values()).filter((e) => e.count >= RAGE_CLICK_THRESHOLD);
}

export const posthogRageClick: Detector = async (window) => {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn("[posthog_rage_click] POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set — skipping");
    return [];
  }

  let entries: RageClickEntry[];
  try {
    entries = await fetchRageClicks(window.current.start, window.current.end, apiKey, projectId);
  } catch (err) {
    console.warn("[posthog_rage_click] fetch error:", err);
    return [];
  }

  if (entries.length === 0) return [];

  // Sort descending by count; emit one signal per hot element (up to 5)
  entries.sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 5);

  const signals: SignalResult[] = top.map((entry) => ({
    detectorName: "posthog_rage_click",
    dedupeKey: `posthog_rage_click:${Buffer.from(`${entry.page}::${entry.element}`).toString("base64").slice(0, 40)}`,
    payload: {
      page: entry.page,
      element: entry.element,
      clickCount: entry.count,
      threshold: RAGE_CLICK_THRESHOLD,
    },
    confidence: Math.min(0.4 + (entry.count / 200) * 0.5, 0.9),
    severity: entry.count >= RAGE_CLICK_THRESHOLD * 4 ? "leak" : "opportunity",
    windowStart: window.current.start,
    windowEnd: window.current.end,
  }));

  return signals;
};
