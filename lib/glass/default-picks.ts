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
  // Hub cards — Ellis's export, 2026-10-25 (frosted main everywhere).
  "hub-wins": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "todo-main": { light: "v05", dark: "v05" },
  "nav-topbar": { light: "v19", dark: "v19" },
  "nav-sidebar": { light: "v19", dark: "v19" },
  "updates-day": { light: "v05", dark: "v05" },
  "sidebar-fees": { light: "v06", dark: "v05" },
  "contacts-card": { light: "v05", dark: "v04" },
  "hub-attention": { light: "v28", dark: "v05" },
  "hub-diary": { light: "v27", dark: "v11" },
  "myfiles-table": { light: "v05", dark: "v05" },
  // My Files · Pipeline / Forecast / Map — these views were left off the glass
  // phase (hardcoded translucent-white surfaces that washed out in dark mode).
  // Matched to the house frosted default (v05) so they read consistently in both
  // modes; Ellis re-picks per card in the Design Lab. 2026-10-04.
  "files-pipeline-column": { light: "v05", dark: "v05" },
  "files-pipeline-card": { light: "v05", dark: "v05" },
  "files-forecast": { light: "v05", dark: "v05" },
  "files-map-patches": { light: "v05", dark: "v05" },
  "overview-risk": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "property-hero": { light: "v08", dark: "cs-9049173a" },
  "sidebar-agent": { light: "v06", dark: "v05" },
  "steps-section": { light: "v05", dark: "v05" },
  "todo-internal": { light: "v05", dark: "v05" },
  "myfiles-search": { light: "v25", dark: "v07" },
  "overview-notes": { light: "v23", dark: "v11" },
  "steps-progress": { light: "v05", dark: "v05" },
  "auto-emails-row": { light: "v08", dark: "v05" },
  // "By sale" cockpit — Ellis's export, 2026-10-25 (the frosted main card, same
  // as the reminders file card). The quiet summary cards (All set / Paused)
  // aren't in the export; matched to the row so the cockpit reads as one piece.
  "auto-cockpit-row": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "auto-cockpit-quiet": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "reminders-group": { light: "v05", dark: "v05" },
  // To-Do task group (GlassCard) — Ellis's export, 2026-10-26 (light moved to the
  // frosted main card to match the dark side and the rest of the To-Do page).
  "todo-page-group": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  // Updates page — Ellis's export, 2026-10-26. The file card moves to the frosted
  // main card (was v16/v02); the day bar, search and filter rail are dark-only
  // picks (light stays their v00 baseline, as exported).
  "updates-tx-card": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "updates-day-bar": { dark: "v05" },
  "updates-search": { dark: "v04" },
  "updates-filter-rail": { dark: "v05" },
  // Completions page — Ellis's export, 2026-10-26. File card + completed row to
  // the frosted main card; the section / completed bars are dark-only v05;
  // momentum keeps its v05 defaultVariant on dark (light-only pick in the export).
  "completions-file-card": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "completions-completed-row": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "completions-section-bar": { dark: "v05" },
  "completions-completed-bar": { dark: "v05" },
  "completions-momentum": { light: "v03" },
  "hub-service-split": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "sidebar-key-dates": { light: "v06", dark: "v05" },
  "milestone-timeline": { light: "v29", dark: "cs-9049173a" },
  "overview-reminders": { light: "v04", dark: "v04" },
  "steps-not-required": { light: "v05", dark: "v10" },
  "analytics-list-card": { light: "v05", dark: "v05" },
  "analytics-stat-card": { light: "v05", dark: "v26" },
  "analytics-counts": { dark: "v14" },
  "hub-activity-ribbon": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "hub-pipeline-glance": { light: "v26", dark: "v14" },
  "hub-pipeline-health": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "overview-ai-summary": { light: "v27", dark: "v05" },
  "overview-solicitors": { light: "v05", dark: "v05" },
  "reminders-completed": { light: "v05", dark: "v05" },
  // Reminders file card (GlassCard) — Ellis's export, 2026-10-25.
  "reminders-file-card": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  // Enquiries · summary card (GlassCard). Light v03 per Ellis's export, 2026-10-25;
  // dark keeps its v05 defaultVariant. Other Enquiries surfaces are useGlassTag so
  // their baked look is passed as a baseline in EnquiriesTriageList, not here.
  "enquiries-summary": { light: "v03" },
  "sidebar-quick-links": { light: "v06", dark: "v05" },
  "sidebar-sale-health": { light: "v06", dark: "v05" },
  "todo-agent-requests": { light: "v05", dark: "v05" },
  "activity-comms-entry": { light: "v22", dark: "v22" },
  "overview-next-action": { light: "v18", dark: "v19" },
  "reminders-filter-bar": { light: "v06", dark: "v02" },
  "hub-exchange-forecast": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "activity-compose-email": { light: "v08", dark: "v08" },
  "reminders-alerts-strip": { light: "v27", dark: "v25" },
  "overview-property-intel": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  // Overview cards — Ellis's export, 2026-10-25 (the main "frosted everywhere" look).
  "overview-people": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "overview-checkpoints": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "overview-activity-notes": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  // Property chain card (newly tagged, see PropertyChainCard). Dark Frosted
  // Main Everywhere, paired with the light main card.
  "overview-chain": { light: "cs-b7c9ec28", dark: "cs-053799eb" },
  "overview-recent-activity": { light: "v05", dark: "v05" },
  "reminders-automated-emails": { light: "v22", dark: "v22" },
  "contacts-person": { light: "v03", dark: "v04" },
  "new-sale-drop-memo": { light: "v26", dark: "v16" },
  "new-sale-research": { light: "v05", dark: "v05" },
  "new-sale-sold-prices": { light: "v05", dark: "v05" },
  "new-sale-hero": { light: "v08", dark: "v04" },
  "new-sale-portal-invite": { light: "v15", dark: "v15" },
  "new-sale-vendors": { light: "v05", dark: "v04" },
  "new-sale-purchasers": { light: "v05", dark: "v04" },
  "new-sale-solicitors": { light: "v05", dark: "v04" },
  "new-sale-chain": { light: "v28", dark: "v28" },
  "new-sale-file-worth": { light: "v06", dark: "v07" },
  "new-sale-notes": { light: "v06", dark: "v04" },

  // Onboarding empty states (Hub / Completions / To-Do / Updates / All Files /
  // Analytics). Mostly dark-only picks — light stays v00 baseline. 2026-08-31.
  "empty-hub-place": { dark: "v04" },
  "empty-hub-attention": { dark: "v04" },
  "empty-hub-picture": { dark: "v04" },
  "empty-hub-finish": { light: "v20", dark: "v19" },
  "hub-email-nudge": { light: "v25", dark: "v21" },
  "empty-completions-profile": { dark: "v04" },
  "empty-completions-agency": { dark: "v04" },
  "empty-completions-invite": { dark: "v04" },
  "empty-todo-notes": { dark: "v04" },
  "empty-todo-sale": { dark: "v04" },
  // Not in Ellis's export (only shows for outsourced agencies) — matched to its
  // two sibling cards so the row is consistent. 2026-08-31.
  "empty-todo-progressor": { dark: "v04" },
  "empty-updates-solicitor": { dark: "v04" },
  "empty-updates-progress": { dark: "v04" },
  "empty-updates-confirmed": { dark: "v04" },
  "empty-allfiles-demo": { light: "v25", dark: "v21" },
  "empty-allfiles-risk": { dark: "v04" },
  "empty-allfiles-next": { dark: "v04" },
  "empty-allfiles-exchange": { dark: "v04" },
  "empty-analytics-solicitors": { dark: "v04" },
  "empty-analytics-commission": { dark: "v04" },
  "empty-analytics-conversion": { dark: "v04" },
  "empty-partners-broker": { dark: "v04" },
  "empty-partners-solicitor": { dark: "v04" },
  "empty-partners-network": { dark: "v04" },
  // Mirrors the All Files "finished example" card.
  "empty-partners-nosales": { light: "v25", dark: "v21" },

  // Enquiries "all clear" empty state — matched to the other empty-state cards
  // (dark v04, light stays v00) so the how-it-works cards render identically.
  "empty-enquiries-overview": { dark: "v04" },
  "empty-enquiries-chasing": { dark: "v04" },

  // Progression-business empty-state variants (Hub owner, Completions owner,
  // Reminders) — these were missing, so their cards fell to v00 (solid dark) while
  // the agency equivalents rendered v04 (frosted). Matched to v04 (dark only, light
  // stays v00) so an external progressor's empty-state cards render identically to
  // every other page. 2026-10-03.
  "empty-hub-prog-clients": { dark: "v04" },
  "empty-hub-prog-sales": { dark: "v04" },
  "empty-hub-prog-picture": { dark: "v04" },
  "empty-completions-add-clients": { dark: "v04" },
  "empty-completions-profile-prog": { dark: "v04" },
  "empty-reminders-chase": { dark: "v04" },
  "empty-reminders-who": { dark: "v04" },
  "empty-reminders-cold": { dark: "v04" },
};
