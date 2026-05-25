import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
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
        // redesign). 302 (permanent: false) keeps the cutover reversible;
        // promote to permanent: true once the Account area is proven.
        source: "/agent/settings",
        destination: "/agent/account/profile",
        permanent: false,
      },
    ];
  },
};

// Sentry wraps the config for source-map upload at build time and to inject
// the auto-instrumentation. When SENTRY_AUTH_TOKEN is unset (local dev) the
// build still succeeds but without source maps — the SDK falls back to
// minified stack traces. That's fine for dev.
export default withSentryConfig(nextConfig, {
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
