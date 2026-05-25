// Sentry server-side init — runs in the Node.js runtime (server actions,
// API routes, server components). DSN read from SENTRY_DSN (not the
// NEXT_PUBLIC_ variant) so the server reads its own secret without exposing
// it to the client bundle.

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
