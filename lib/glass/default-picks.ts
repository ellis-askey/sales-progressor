import type { GlassPicks } from "./variants";

// App-wide per-mode glass defaults — Ellis's Design Lab picks, applied as the
// baseline look for every user (overridable per-account via the Design Lab).
//
// Fallback order in usePickForCard:
//   user's own pick  →  DEFAULT_PICKS  →  GlassCard's defaultVariant prop  →  v00
// so an entry here overrides the component's hardcoded defaultVariant.
//
// A glassId with no matching GlassCard on screen is simply inert. Grows as
// Ellis sends more pages of picks. Typed as GlassPicks so every id is
// compile-checked against the variant catalog. 2026-08-10.
export const DEFAULT_PICKS: GlassPicks = {
  "hub-wins": { light: "v05", dark: "v05" },
  "todo-main": { light: "v05", dark: "v05" },
  "nav-topbar": { light: "v19", dark: "v19" },
  "nav-sidebar": { light: "v19", dark: "v19" },
  "updates-day": { light: "v05", dark: "v05" },
  "sidebar-fees": { light: "v06", dark: "v05" },
  "contacts-card": { light: "v05", dark: "v04" },
  "hub-attention": { light: "v28", dark: "v05" },
  "hub-diary": { light: "v27", dark: "v11" },
  "myfiles-table": { light: "v05", dark: "v05" },
  "overview-risk": { light: "v05", dark: "v05" },
  "property-hero": { light: "v08", dark: "v04" },
  "sidebar-agent": { light: "v06", dark: "v05" },
  "steps-section": { light: "v05", dark: "v05" },
  "todo-internal": { light: "v05", dark: "v05" },
  "myfiles-search": { light: "v25", dark: "v07" },
  "overview-notes": { light: "v23", dark: "v11" },
  "steps-progress": { light: "v05", dark: "v05" },
  "auto-emails-row": { light: "v08", dark: "v05" },
  "reminders-group": { light: "v05", dark: "v05" },
  "todo-page-group": { light: "v05", dark: "v05" },
  "updates-tx-card": { light: "v16", dark: "v02" },
  "hub-service-split": { light: "v05", dark: "v05" },
  "sidebar-key-dates": { light: "v06", dark: "v05" },
  "milestone-timeline": { light: "v29", dark: "v26" },
  "overview-reminders": { light: "v04", dark: "v04" },
  "steps-not-required": { light: "v05", dark: "v10" },
  "analytics-list-card": { light: "v05", dark: "v05" },
  "analytics-stat-card": { light: "v05", dark: "v26" },
  "analytics-counts": { dark: "v14" },
  "hub-activity-ribbon": { light: "v05", dark: "v05" },
  "hub-pipeline-glance": { light: "v26", dark: "v14" },
  "hub-pipeline-health": { light: "v05", dark: "v05" },
  "overview-ai-summary": { light: "v27", dark: "v05" },
  "overview-solicitors": { light: "v05", dark: "v05" },
  "reminders-completed": { light: "v05", dark: "v05" },
  "reminders-file-card": { light: "v05", dark: "v05" },
  "sidebar-quick-links": { light: "v06", dark: "v05" },
  "sidebar-sale-health": { light: "v06", dark: "v05" },
  "todo-agent-requests": { light: "v05", dark: "v05" },
  "activity-comms-entry": { light: "v22", dark: "v22" },
  "overview-next-action": { light: "v18", dark: "v07" },
  "reminders-filter-bar": { light: "v06", dark: "v19" },
  "hub-exchange-forecast": { light: "v05", dark: "v05" },
  "activity-compose-email": { light: "v08", dark: "v08" },
  "reminders-alerts-strip": { light: "v27", dark: "v25" },
  "overview-property-intel": { light: "v05", dark: "v05" },
  "overview-recent-activity": { light: "v05", dark: "v05" },
  "reminders-automated-emails": { light: "v22", dark: "v22" },
  "contacts-person": { light: "v03", dark: "v04" },
};
