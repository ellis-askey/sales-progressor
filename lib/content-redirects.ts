// Command Centre — legacy Content routes → the canonical tabbed workspace
// (/command/content). Consolidation Phase 4A. See
// docs/active/admin-workspace/06-CONTENT-CONSOLIDATION.md §9.
//
// Why this lives in lib/ (not lib/command/): next.config.ts imports it to build
// its redirects(), and the `no-command-import-outside` lint rule forbids root
// files importing from lib/command/. This is pure data (no imports), so it is
// safe to pull into the Next config, which is evaluated very early.
//
// How it works (route safety):
//  • Next.js evaluates next.config redirects() BEFORE filesystem routes, so each
//    redirect SHADOWS the still-present legacy page at the same path — no page
//    deletion is required to activate them (legacy files stay for rollback until
//    Phase 4B). Same mechanism as the existing /agent/settings redirect.
//  • Next forwards the request's query string onto the destination and merges it
//    with the destination's own query. Legacy content routes only ever carry
//    `item` / `opp` / `thought` (Create seeds) and `error` (validation), none of
//    which collide with the canonical `tab` / `source` / `build` / `view` params,
//    so seeds and errors are preserved and land in the right view, which reads
//    and DISPLAYS them (Create → Drafts voice gate; Brand → Voice add-sample).
//  • permanent:false (302) — reversible while we verify, before Phase 4B retires
//    the legacy implementations.
//
// Intentionally NOT redirected (preserved as their own routes):
//  • /command/content                      — this IS the canonical workspace.
//  • /command/content/engagement/[draftId] — the per-post results drill-down.
//  • /think                                — the standalone quick-capture page.

export interface SimpleRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const CONTENT_REDIRECTS: SimpleRedirect[] = [
  // Ideas tab (secondary ?source= strip)
  { source: "/command/content/inbox", destination: "/command/content?tab=ideas&source=inbox", permanent: false },
  { source: "/command/content/opportunities", destination: "/command/content?tab=ideas&source=opportunities", permanent: false },
  { source: "/command/content/thoughts", destination: "/command/content?tab=ideas&source=thoughts", permanent: false },
  { source: "/command/content/topics", destination: "/command/content?tab=ideas&source=topics", permanent: false },

  // Create tab (secondary ?build= strip). item/opp/thought/error forwarded by Next.
  { source: "/command/content/create", destination: "/command/content?tab=create&build=new", permanent: false },
  { source: "/command/content/drafts", destination: "/command/content?tab=create&build=drafts", permanent: false },

  // Plan + Measure tabs (single view each)
  { source: "/command/content/calendar", destination: "/command/content?tab=plan", permanent: false },
  { source: "/command/content/performance", destination: "/command/content?tab=measure", permanent: false },

  // Brand tab (secondary ?view= strip). error forwarded by Next (voice add-sample).
  { source: "/command/content/strategy", destination: "/command/content?tab=brand&view=strategy", permanent: false },
  { source: "/command/content/brand", destination: "/command/content?tab=brand&view=positioning", permanent: false },
  { source: "/command/content/voice", destination: "/command/content?tab=brand&view=voice", permanent: false },
];
