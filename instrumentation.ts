// Next.js 15+ entry point for runtime instrumentation. The Sentry SDK
// uses this to register the right config file per runtime. Without this,
// only the client config loads.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry-specific: bubble React server-component render errors up to the
// SDK. Next.js 15 + Sentry 10 exposes captureRequestError as the named
// import we re-export under the framework hook name onRequestError.
import * as Sentry from "@sentry/nextjs";
export const onRequestError = Sentry.captureRequestError;
