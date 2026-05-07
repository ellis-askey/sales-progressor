"use client";
// components/layout/SignOutButton.tsx

import { signOut } from "next-auth/react";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function SignOutButton() {
  function handleSignOut() {
    analytics.track(ANALYTICS_EVENTS.USER_SIGNED_OUT, {});
    analytics.reset();
    signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
    >
      Sign out
    </button>
  );
}
