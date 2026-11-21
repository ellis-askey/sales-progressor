import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { CONTENT_REDIRECTS } from "./lib/content-redirects";
import { GROWTH_REDIRECTS } from "./lib/growth-redirects";
import { MONEY_REDIRECTS } from "./lib/money-redirects";
import { OPERATIONS_REDIRECTS } from "./lib/operations-redirects";
import { PLATFORM_REDIRECTS } from "./lib/platform-redirects";
import { SYSTEM_REDIRECTS } from "./lib/system-redirects";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Phase 3 perceived-performance (2026-09-18, PERF-05): router-cache reuse
  // for just-visited pages is deliberately NOT set globally here. A global
  // experimental.staleTimes.dynamic would also let buyer/seller PORTAL
  // navigations serve a cached payload for up to that window — a genuine
  // behaviour change outside the performance programme's boundary. Instead,
  // each agent-app page opts in individually via
  //   export const unstable_dynamicStaleTime = 30
  // (per-page segment config; pages only, portal pages never export it, so
  // they keep the default 0 = always server-rendered on navigation).
  async redirects() {
    return [
      {
        source: "/agent/hub-preview",
        destination: "/agent/hub",
        permanent: true,
      },
      {
        source: "/agent/exchanges",
        destination: "/agent/dashboard?filter=active",
        permanent: false,
      },
      {
        // Account-area cutover (Stage 5). /agent/settings has been split
        // across /agent/account/{billing,profile,team,notifications}.
        // Profile is the closest semantic match to the old settings
        // surface, and it's a both-roles tab so the redirect is safe for
        // every viewer. Exact-match source — does NOT cascade to
        // /agent/settings/automation, which intentionally stays serving
        // (orphan route, zero UI links, picked up by a future automation
        // redesign).
        //
        // Promoted from 302 → 301 (permanent: true) on 2026-05-25 as part
        // of the clean-break cleanup, after the Account area was proven
        // live on prod. Browser/SEO caches now treat this as permanent —
        // rollback is no longer cheap, so the legacy page file may also
        // be safely deleted (see commit deleting app/agent/settings/page.tsx).
        source: "/agent/settings",
        destination: "/agent/account/profile",
        permanent: true,
      },
      {
        // Account-area cutover (Stage 6). The V1 /agent/billing hub
        // (glass-card chrome) is retired in favour of /agent/account/billing
        // (v2 hub, clean canvas, same data). All six runtime inbound refs
        // are repointed; this redirect is the safety net for director
        // bookmarks, any cached Stripe-emailed receipt URLs, and straggler
        // /agent/billing visits. Exact-match source — does NOT cascade to
        // /agent/billing/payment-method, which has its own dedicated
        // redirect that lands directly on /agent/account/billing#payment-method
        // (single hop).
        //
        // Promoted from 302 → 301 (permanent: true) on 2026-05-25 alongside
        // /agent/settings — same reasoning, same clean-break commit.
        source: "/agent/billing",
        destination: "/agent/account/billing",
        permanent: true,
      },
      // Command Centre content consolidation (Phase 4A): the ten legacy
      // /command/content/* pages now redirect into the single tabbed workspace
      // at /command/content. These run before the filesystem routes, so the
      // legacy page files stay in place (rollback-able) but are shadowed until
      // Phase 4B retires them. See lib/content-redirects.ts for the full map +
      // the query-preservation / route-safety reasoning.
      ...CONTENT_REDIRECTS,
      // Command Centre growth-analytics consolidation (Phase 5A): the nine
      // retired /command/* dashboard pages redirect into the single tabbed
      // workspace at /command/growth. Same shadow-before-filesystem mechanism;
      // legacy page files stay in place until Phase 5B. /command/growth itself,
      // /command/prospects, /command/ai-outreach and /command/timeframes are NOT
      // redirected. See lib/growth-redirects.ts.
      ...GROWTH_REDIRECTS,
      // Command Centre Money consolidation: the three Money landing pages
      // (Revenue / Quote inbox / Surveyor firms) redirect into the tabbed
      // workspace at /command/money. Exact sources — the detail/config/breakdown
      // routes under /command/revenue/* and /command/providers/* are not
      // cascaded. See lib/money-redirects.ts.
      ...MONEY_REDIRECTS,
      // Command Centre Operations consolidation: the eight Operations landing
      // pages redirect into the tabbed workspace at /command/operations. Exact
      // sources — the Files ?tx= drawer stays on the same route. See
      // lib/operations-redirects.ts.
      ...OPERATIONS_REDIRECTS,
      // Command Centre Platform consolidation: the seven Platform areas (incl.
      // Timeframes, moved from Growth) redirect into the tabbed workspace at
      // /command/platform. Exact sources. See lib/platform-redirects.ts.
      ...PLATFORM_REDIRECTS,
      // Command Centre System consolidation (final section): the six System
      // landing pages redirect into the tabbed workspace at /command/system.
      // Exact sources — the Settings → Connections detail route stays. See
      // lib/system-redirects.ts.
      ...SYSTEM_REDIRECTS,
    ];
  },
};

// Sentry wraps the config for source-map upload at build time and to inject
// the auto-instrumentation. When SENTRY_AUTH_TOKEN is unset (local dev) the
// build still succeeds but without source maps — the SDK falls back to
// minified stack traces. That's fine for dev.
//
// IMPORTANT (2026-11-19): Sentry's build plugin injects a webpack config, which
// forces `next dev` out of Turbopack and into the much slower webpack dev
// server (6+ postcss workers, slow recompiles). Sentry is only needed at BUILD
// time, so wrap only for production builds; local dev runs the plain config on
// Turbopack. The Sentry SDK still initialises at runtime via instrumentation —
// that is unaffected by skipping the build plugin here.
const isDev = process.env.NODE_ENV === "development";

export default isDev ? nextConfig : withSentryConfig(nextConfig, {
  // Org + project slugs come from the Sentry dashboard. Set as env vars in
  // Vercel so this file doesn't hard-code them.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress wizard output during builds.
  silent: !process.env.CI,
  // Upload source maps for clean stack traces in Sentry.
  widenClientFileUpload: true,
  // Tunnel Sentry requests through a Next.js route to bypass ad-blockers.
  // Disabled for now — adds complexity, low-value at our scale. Flip on
  // later if real users report blocked Sentry traffic.
  tunnelRoute: undefined,
  // Avoid bundle-size penalty in client.
  disableLogger: true,
});
