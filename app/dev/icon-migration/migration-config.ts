// ─────────────────────────────────────────────────────────────────────────────
// SOLAR BOLD DUOTONE — ICON MIGRATION CONFIG  (PREPARED, NOT ACTIVATED)
// ─────────────────────────────────────────────────────────────────────────────
// This is the single source of truth for a future, approved icon swap across the
// three dashboards. It is DATA ONLY. Nothing here is wired into any production
// component, import or style. Importing this file changes no rendered icon.
//
// It exists so that, IF the migration is approved, applying it is a small,
// consistent, reversible step: a thin `<AppIcon>` shim (built later, only inside
// the in-scope dashboard component trees) would read CURRENT→solar from this map
// and render the Solar body at the same size/colour. Until that shim is built and
// adopted per-component, the live app is untouched.
//
// Rendering requirements that ANY future shim MUST honour (preserve, don't
// redesign): same rendered size, same colour + colour inheritance (currentColor),
// same hover/active/selected/disabled colours, same spacing/alignment, same tap
// target, same animation, same aria-label. Solar's two-tone character is kept via
// currentColor (primary = the existing colour; secondary = a lighter opacity of
// the SAME hue). No backgrounds, circles, tiles or gradients are ever added.

import { SOLAR_MAP, type MapStatus, type SolarMapEntry } from "./data/solar.generated";

export type { MapStatus, SolarMapEntry };

export const RENDERING_REQUIREMENTS = {
  preserveSize: true,
  preserveColor: true,
  inheritCurrentColor: true,
  preserveHoverActiveSelectedDisabled: true,
  preserveSpacingAlignment: true,
  preserveTapTarget: true,
  preserveAnimation: true,
  preserveAriaLabel: true,
  duotoneFromSingleHue: true, // secondary layer = lighter opacity of the same colour
  addNoBackground: true,
} as const;

// The migration map, keyed by "lib:Name" (e.g. "phosphor:CaretDown").
export const MIGRATION: Record<string, SolarMapEntry> = SOLAR_MAP;

// Scope guard — the migration MUST only ever reach these areas. A global icon
// override is explicitly forbidden because shared components also render in the
// excluded areas below; the shim must be adopted per-component inside the
// in-scope trees, never swapped at the library level.
export const MIGRATION_SCOPE = {
  include: [
    "app/agent/** (TSP internal, Agent, External Progressor — same surface, role-gated)",
    "app/(account)/**",
    "app/(business-settings)/** (External Progressor settings)",
    "components/** used by the above (shared dashboard components)",
  ],
  neverChange: [
    "app/command/**, components/command/** (Command Centre)",
    "app/portal/**, components/portal/** (buyer/seller portal)",
    "solicitor / broker portals",
    "login / signup / password reset / auth",
    "public + marketing pages",
    "app/boardwalk/**, components/boardwalk/**",
  ],
  // Shared components that ALSO render in an excluded area — must NOT be swapped
  // at the component level (would leak into the portal/Command Centre). Handle by
  // passing the icon in from the dashboard caller, or leaving them unchanged. The
  // computed list (from the import-graph scan) is in the preview's Decisions view;
  // as of the last scan: components/agent/AgentToaster.tsx (X),
  // components/feedback/FeedbackWidget.tsx (HelpCircle).
  sharedWithExcludedRisk: [
    "components/agent/AgentToaster.tsx",
    "components/feedback/FeedbackWidget.tsx",
  ],
} as const;

// How a future apply + rollback would work (documented, not executed):
export const APPLY_STRATEGY = {
  approach:
    "Add an <AppIcon name=.../> shim under components/ (dashboard-only). It renders the Solar body for mapped icons and falls back to the current component for `keep`/`decision`. Adopt it one component at a time inside the in-scope trees. Never replace the lucide/phosphor imports globally.",
  rollback:
    "Revert per-component adoption, or flip a single MIGRATION_ENABLED flag in the shim to render the current icon everywhere. Because imports are untouched, rollback is a one-line change with no data migration.",
  verification:
    "Re-run the occurrence scan after adoption to confirm no excluded area received the shim, and screenshot diffs at 1280px + 375px, light + dark.",
} as const;
