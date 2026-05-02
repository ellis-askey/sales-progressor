// PostHog analytics wrapper.
// COMPLIANCE: This module is the single chokepoint for all PostHog calls.
// No application code imports posthog-js directly (enforced by ESLint rule below).
// SDK is never initialised, identified, or captured before consent is given.
//
// ESLint note: add this rule to .eslintrc to block direct imports:
//   "no-restricted-imports": ["error", { "paths": [{ "name": "posthog-js" }] }]
//   with an override allowing "lib/analytics/posthog.ts" itself.

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = "https://eu.i.posthog.com";

// Allow-list of event names. Calls with names outside this set are silently dropped.
export const ALLOWED_EVENT_NAMES = new Set([
  "funnel.add_solicitor.started",
  "funnel.add_solicitor.completed",
  "funnel.add_solicitor.abandoned",
  "friction.field_corrected_3x",
  "friction.scroll_thrash",
]);

// Allow-list of property names. Any property not here is stripped before capture.
const ALLOWED_PROPS = new Set([
  "agencyId",
  "transactionId",
  "serviceType",
  "modeProfile",
  "userRole",
  "signupSource",
  "pagePath",
  "fieldName",
]);

// Module-level init flag — the single source of truth for "has consent been given."
// Reset only possible via a full page reload (SDK limitation).
let _initialized = false;

function sanitize(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED_PROPS.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Initialise PostHog. Must be called AFTER the user gives consent.
 * Calling with consent = false is a no-op (SDK stays dormant).
 * Safe to call multiple times — subsequent calls after init are ignored.
 */
export function init(consent: boolean): void {
  if (!consent || !POSTHOG_KEY || _initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    disable_session_recording: true, // off in v1 — ADMIN_10 §5; set to false + follow §3.3 checklist to enable
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: "identified_only",
  });

  _initialized = true;
}

/** Wire the authenticated user to their PostHog person. No-op before consent. */
export function identify(userId: string, props: Record<string, unknown>): void {
  if (!_initialized) return;
  posthog.identify(userId, sanitize(props));
}

/** Capture a named event. No-op before consent or if event name not in allow-list. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!_initialized) return;
  if (!ALLOWED_EVENT_NAMES.has(event)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] Dropped: event not in allow-list:", event);
    }
    return;
  }
  posthog.capture(event, sanitize(props));
}

/** Reset PostHog person when user logs out or consent is revoked. */
export function reset(): void {
  if (!_initialized) return;
  posthog.reset();
  _initialized = false;
}

/** Exposed for testing — do not call in application code. */
export function _isInitialized(): boolean {
  return _initialized;
}
