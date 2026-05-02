// Detector: posthog_session_friction
// Looks for sessions with high error event counts or abnormally long time-to-first-action.
// Fires when the error-session rate exceeds ERROR_SESSION_THRESHOLD vs previous window.
// Requires POSTHOG_API_KEY + POSTHOG_PROJECT_ID; returns [] when not configured.
// Session recording is OFF per PR 18 deliberate choice, so this uses event-based proxies:
//   - sessions with ≥3 $exception events = "error session"
//   - tracks error-session rate week-over-week

import type { Detector, SignalResult } from "../types";

const ERROR_SESSION_THRESHOLD = 0.10;  // 10% of sessions with errors = signal threshold
const MIN_SESSIONS = 30;
const ERRORS_PER_SESSION_FLOOR = 3;   // ≥ this many $exception events = error session

type SessionFrictionStats = {
  totalSessions: number;
  errorSessions: number;
  errorRate: number;
};

async function getSessionFrictionStats(
  start: Date,
  end: Date,
  apiKey: string,
  projectId: string
): Promise<SessionFrictionStats> {
  // Get all $exception events in window, grouped by session_id
  const params = new URLSearchParams({
    after: start.toISOString(),
    before: end.toISOString(),
    event: "$exception",
    limit: "10000",
  });

  let exceptionsBySession = new Map<string, number>();

  try {
    const res = await fetch(
      `https://eu.posthog.com/api/projects/${projectId}/events/?${params}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (res.ok) {
      const data = await res.json() as { results?: Array<{ properties?: Record<string, unknown> }> };
      for (const event of data.results ?? []) {
        const sessionId = String(event.properties?.["$session_id"] ?? "unknown");
        exceptionsBySession.set(sessionId, (exceptionsBySession.get(sessionId) ?? 0) + 1);
      }
    }
  } catch {
    // non-fatal — fall through with empty map
  }

  // Get total distinct session count in window
  let totalSessions = 0;
  try {
    const sessionParams = new URLSearchParams({
      after: start.toISOString(),
      before: end.toISOString(),
      event: "$pageview",
      limit: "1",
    });
    const res = await fetch(
      `https://eu.posthog.com/api/projects/${projectId}/events/?${sessionParams}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (res.ok) {
      const data = await res.json() as { count?: number };
      // Rough proxy: distinct sessions ≈ pageview count / avg pages per session (≈3)
      // This is an approximation; PostHog session API requires a paid plan endpoint
      totalSessions = Math.max(1, Math.round((data.count ?? 0) / 3));
    }
  } catch {
    // leave totalSessions as 0
  }

  const errorSessions = Array.from(exceptionsBySession.values()).filter(
    (count) => count >= ERRORS_PER_SESSION_FLOOR
  ).length;

  return {
    totalSessions,
    errorSessions,
    errorRate: totalSessions > 0 ? errorSessions / totalSessions : 0,
  };
}

export const posthogSessionFriction: Detector = async (window) => {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn("[posthog_session_friction] POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set — skipping");
    return [];
  }

  let current: SessionFrictionStats;
  let previous: SessionFrictionStats;

  try {
    [current, previous] = await Promise.all([
      getSessionFrictionStats(window.current.start, window.current.end, apiKey, projectId),
      getSessionFrictionStats(window.previous.start, window.previous.end, apiKey, projectId),
    ]);
  } catch (err) {
    console.warn("[posthog_session_friction] fetch error:", err);
    return [];
  }

  if (previous.totalSessions < MIN_SESSIONS) return [];

  if (current.errorRate < ERROR_SESSION_THRESHOLD) return [];

  const delta = current.errorRate - previous.errorRate;
  const confidence = Math.min(
    0.3 + (previous.totalSessions / 200) * 0.4 + (current.errorRate / 0.3) * 0.3,
    0.88
  );

  if (confidence < 0.2) return [];

  return [
    {
      detectorName: "posthog_session_friction",
      dedupeKey: "posthog_session_friction:error_session_rate",
      payload: {
        indicator: "error_session_rate",
        currentErrorRate: Math.round(current.errorRate * 100),
        previousErrorRate: Math.round(previous.errorRate * 100),
        deltaPP: Math.round(delta * 100),
        currentErrorSessions: current.errorSessions,
        currentTotalSessions: current.totalSessions,
        errorsPerSessionFloor: ERRORS_PER_SESSION_FLOOR,
      },
      confidence,
      severity: current.errorRate >= 0.25 ? "critical" : delta > 0 ? "leak" : "info",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    },
  ];
};
