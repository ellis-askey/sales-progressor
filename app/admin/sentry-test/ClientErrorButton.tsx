"use client";

import * as Sentry from "@sentry/nextjs";

export function ClientErrorButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Two paths so we don't rely on one capture mechanism:
        //   1. Direct Sentry.captureException — guaranteed delivery if SDK loaded
        //   2. Async throw via setTimeout — escapes React's event-handler
        //      interception so the global window.onerror handler (Sentry's
        //      browser integration) actually sees it
        Sentry.captureException(
          new Error("SENTRY_TEST_CLIENT_DIRECT — direct captureException call"),
        );
        setTimeout(() => {
          throw new Error("SENTRY_TEST_CLIENT_THROW — async throw, escapes React handler");
        }, 0);
      }}
      style={{
        padding: "8px 16px",
        background: "#3b82f6",
        color: "white",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      Trigger client-side error
    </button>
  );
}
