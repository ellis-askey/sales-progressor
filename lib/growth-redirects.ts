// Command Centre — legacy Growth analytics routes → the canonical tabbed
// workspace (/command/growth). Consolidation Phase 5A. Sibling of
// lib/content-redirects.ts; placed in lib/ (not lib/command/) so next.config.ts
// can import it without the `no-command-import-outside` lint rule. Pure data.
//
// Route safety (same mechanism as content-redirects):
//  • Next evaluates next.config redirects() BEFORE filesystem routes, so each
//    redirect SHADOWS the still-present legacy page — no page deletion needed
//    (Phase 5B retires the files). Rollback = remove the spread / restore order.
//  • permanent:false (302) — reversible.
//  • Next forwards the request query onto the destination; the retired Growth
//    routes carry only view-local params (period/tier, range, mode/agency,
//    surface/sort/feature) — none collide with the canonical tab/view.
//
// NOT redirected (kept as their own routes): /command/growth itself (it IS the
// workspace), /command/prospects, /command/ai-outreach, /command/timeframes.
//
// enquiries-chase is the one real collision: its legacy ?tab= would clash with
// the workspace top-level ?tab. The two entries below map it to ?chase= — the
// first captures the sub-view value via a `has` condition and references it as
// :v in the destination (which consumes `tab` so Next does not re-forward it);
// the second is the default/other fallback. As defence-in-depth, the workspace
// shell also coerces a duplicated `tab` to its first value (always the
// destination's `experiments`), so a legacy `tab` can never win even if Next's
// forwarding differs from the documented behaviour. See
// docs/active/admin-workspace/07-GROWTH-CONSOLIDATION.md §11d/§11e and
// lib/growth-chasing-compat.ts (the mapping oracle).

export interface GrowthRedirect {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: "query"; key: string; value: string }[];
}

export const GROWTH_REDIRECTS: GrowthRedirect[] = [
  // Acquisition tab (?view=website|invites). period/tier + range forwarded by Next.
  { source: "/command/website-growth", destination: "/command/growth?tab=acquisition&view=website", permanent: false },
  { source: "/command/chain-invites", destination: "/command/growth?tab=acquisition&view=invites", permanent: false },

  // Activation tab. mode/agency forwarded.
  { source: "/command/activation", destination: "/command/growth?tab=activation", permanent: false },

  // Engagement tab (?view=features|adoption). mode/agency/period/surface/sort/feature forwarded.
  { source: "/command/followup-usage", destination: "/command/growth?tab=engagement&view=features", permanent: false },
  { source: "/command/adoption", destination: "/command/growth?tab=engagement&view=adoption", permanent: false },

  // Retention tab. mode/agency forwarded.
  { source: "/command/retention", destination: "/command/growth?tab=retention", permanent: false },

  // Experiments tab (?view=tests|chasing).
  { source: "/command/experiments", destination: "/command/growth?tab=experiments&view=tests", permanent: false },

  // Chasing: legacy ?tab=<solicitor|client|opted_out> → ?chase=<value> (the
  // named capture :v consumes `tab` so it isn't re-forwarded). MUST precede the
  // bare fallback. Default / enquiries / invalid tab → the no-chase default.
  {
    source: "/command/enquiries-chase",
    has: [{ type: "query", key: "tab", value: "(?<v>solicitor|client|opted_out)" }],
    destination: "/command/growth?tab=experiments&view=chasing&chase=:v",
    permanent: false,
  },
  { source: "/command/enquiries-chase", destination: "/command/growth?tab=experiments&view=chasing", permanent: false },
];
