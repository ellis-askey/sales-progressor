// Sentry edge init — runs in Vercel Edge Runtime (middleware.ts, edge API
// routes). Smaller runtime; some Sentry features (replays, profiling) are
// not available here.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
    sendDefaultPii: false,
  });
}
