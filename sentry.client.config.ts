// Sentry client-side init — runs in the browser.
// Catches React errors, unhandled promise rejections, route-render errors.
//
// DSN is supplied via NEXT_PUBLIC_SENTRY_DSN (must be NEXT_PUBLIC_ because the
// client bundle needs to read it at build time). When the env var is unset the
// SDK is a no-op — safe for local dev without a Sentry account.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 10% traces sample rate — every transaction is expensive; keep it low for
    // a pre-launch app. Bump if performance data becomes useful.
    tracesSampleRate: 0.1,
    // Capture all session replays for errors only — no full-session replay.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    // Tag environment so Sentry dashboards can filter staging vs prod.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Send PII off by default — opt-in via setUser elsewhere if/when we want
    // user attribution in error context.
    sendDefaultPii: false,
  });
}
