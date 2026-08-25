/**
 * Centralised PostHog event taxonomy.
 * Never inline event name strings — always import from here.
 * Naming convention: noun_verb (e.g. transaction_created, milestone_confirmed).
 */
export const ANALYTICS_EVENTS = {
  // Auth & onboarding
  USER_SIGNED_UP:              "user_signed_up",
  USER_SIGNED_IN:              "user_signed_in",
  USER_SIGNED_OUT:             "user_signed_out",
  ONBOARDING_STEP_COMPLETED:   "onboarding_step_completed",

  // Theme
  THEME_CHANGED: "theme_changed",

  // Transactions
  TRANSACTION_CREATED:        "transaction_created",
  TRANSACTION_DELETED:        "transaction_deleted",
  TRANSACTION_STATUS_CHANGED: "transaction_status_changed",
  TRANSACTION_VIEWED:         "transaction_viewed",

  // Milestones
  MILESTONE_CONFIRMED:   "milestone_confirmed",
  MILESTONE_UNCONFIRMED: "milestone_unconfirmed",

  // Notes
  NOTE_ADDED: "note_added",

  // Portal
  PORTAL_LINK_SENT:                 "portal_link_sent",
  PORTAL_VISITED:                   "portal_visited",
  PORTAL_MESSAGE_SENT_BY_AGENT:     "portal_message_sent_by_agent",
  PORTAL_MESSAGE_SENT_BY_CONTACT:   "portal_message_sent_by_contact",

  // Invitations — director (Project B)
  DIRECTOR_INVITATION_SENT:     "director_invitation_sent",
  DIRECTOR_INVITATION_ACCEPTED: "director_invitation_accepted",
  DIRECTOR_INVITATION_RESENT:   "director_invitation_resent",

  // Invitations — negotiator (R1)
  NEGOTIATOR_INVITATION_SENT:     "negotiator_invitation_sent",
  NEGOTIATOR_INVITATION_ACCEPTED: "negotiator_invitation_accepted",

  // Chain invites — conversion funnel (Phase 0 + the Phase 3 nudge)
  CHAIN_INVITE_SENT:      "chain_invite_sent",
  CHAIN_INVITE_VIEWED:    "chain_invite_viewed",
  CHAIN_CLAIM_STARTED:    "chain_claim_started",
  CHAIN_CLAIM_COMPLETED:  "chain_claim_completed",
  CHAIN_INVITE_DECLINED:  "chain_invite_declined",
  CHAIN_INVITE_NUDGED:    "chain_invite_nudged",

  // High-value page views
  PAGE_VIEW_HUB:        "page_view_hub",
  PAGE_VIEW_ANALYTICS:  "page_view_analytics",
  PAGE_VIEW_WORK_QUEUE: "page_view_work_queue",
  PAGE_VIEW_SETTINGS:   "page_view_settings",

  // Analytics interactions
  ANALYTICS_PERIOD_CHANGED: "analytics_period_changed",
  ANALYTICS_FILTER_CHANGED: "analytics_filter_changed",
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
