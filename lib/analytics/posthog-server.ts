import { PostHog } from "posthog-node";

// EU cluster — must match the client-side host in lib/analytics/posthog.ts
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return null;

  if (!_client) {
    _client = new PostHog(key, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _client;
}

/**
 * Capture a server-side PostHog event.
 * Pass the authenticated user's DB id as distinctId so server and client
 * events are stitched to the same person profile.
 * For portal/unauthenticated contexts use a stable synthetic id like
 * `portal-${contactId}`.
 * No-ops silently when POSTHOG_API_KEY is unset.
 */
export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = getClient();
  if (!ph) return;

  ph.capture({ distinctId, event, properties });
  await ph.flush();
}
