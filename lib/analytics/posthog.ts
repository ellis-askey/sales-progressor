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
  // Legacy funnel / friction events
  "funnel.add_solicitor.started",
  "funnel.add_solicitor.completed",
  "funnel.add_solicitor.abandoned",
  "friction.field_corrected_3x",
  "friction.scroll_thrash",

  // R2 — auth & onboarding
  "user_signed_up",
  "signup_started",
  "user_signed_in",
  "user_signed_out",
  "onboarding_step_completed",

  // R2 — theme
  "theme_changed",

  // R2 — transactions
  "transaction_created",
  "transaction_deleted",
  "transaction_status_changed",
  "transaction_viewed",

  // R2 — milestones
  "milestone_confirmed",
  "milestone_unconfirmed",

  // R2 — notes
  "note_added",

  // R2 — portal
  "portal_link_sent",
  "portal_visited",
  "portal_message_sent_by_agent",
  "portal_message_sent_by_contact",

  // R2 — invitations
  "director_invitation_sent",
  "director_invitation_accepted",
  "director_invitation_resent",
  "negotiator_invitation_sent",
  "negotiator_invitation_accepted",

  // R2 — page views
  "page_view_hub",
  "page_view_analytics",
  "page_view_work_queue",
  "page_view_settings",

  // R2 — analytics interactions
  "analytics_period_changed",
  "analytics_filter_changed",

  // Demo guided-walkthrough funnel (kept in its own namespace so it never
  // mixes with real sale/product analytics). See DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md §14.
  "demo_opened",
  "demo_tour_started",
  "demo_tour_step_viewed",
  "demo_tour_step_completed",
  "demo_tour_skipped",
  "demo_tour_completed",
]);

// Allow-list of property names. Any property not here is stripped before capture.
const ALLOWED_PROPS = new Set([
  // Identity
  "agencyId",
  "agencyName",
  "userRole",

  // Transactions
  "transactionId",
  "serviceType",
  "oldStatus",
  "newStatus",

  // Milestones
  "milestoneId",
  "milestoneName",
  "milestoneCode",
  "milestoneSide",

  // Portal / contacts
  "contactId",
  "roleType",

  // Invitations / auth
  "provider",
  "invitationType",
  "step",

  // Analytics interactions
  "period",
  "filterType",

  // Page context
  "pagePath",
  "activeCount",
  "attentionCount",

  // Legacy / misc
  "modeProfile",
  "signupSource",
  "fieldName",
  "theme",

  // Demo guided-walkthrough. deviceClass (D8) = mobile / tablet / desktop split.
  "stepId",
  "stepNumber",
  "totalSteps",
  "interactionType",
  "deviceClass",
]);

// Person-profile-only props — allowed on identify() (PostHog person
// properties) but ALWAYS stripped from event capture. ADMIN_10
// non-negotiable #2: no PII on events. "email" briefly sat in
// ALLOWED_PROPS above (added for identify), which silently let it onto
// captured events too and broke the compliance regression test.
const IDENTIFY_ONLY_PROPS = new Set(["email"]);

// Module-level init flag — the single source of truth for "has consent been given."
// Reset only possible via a full page reload (SDK limitation).
let _initialized = false;

function sanitize(
  props: Record<string, unknown>,
  extraAllowed?: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED_PROPS.has(k) || extraAllowed?.has(k)) out[k] = v;
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
  posthog.identify(userId, sanitize(props, IDENTIFY_ONLY_PROPS));
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
