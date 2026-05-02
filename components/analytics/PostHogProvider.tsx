"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import * as analytics from "@/lib/analytics/posthog";
import { getConsent } from "@/lib/analytics/consent";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Initialise PostHog on mount if the user has already given consent
  useEffect(() => {
    const { analytics: hasConsent } = getConsent();
    analytics.init(hasConsent);
  }, []);

  // Re-init (or reset) when the user makes/changes their consent decision
  useEffect(() => {
    function handleConsentUpdate(e: Event) {
      const { analytics: hasConsent } = (e as CustomEvent<{ analytics: boolean }>).detail;
      if (hasConsent) {
        analytics.init(true);
      } else {
        analytics.reset();
      }
    }
    window.addEventListener("consent-updated", handleConsentUpdate);
    return () => window.removeEventListener("consent-updated", handleConsentUpdate);
  }, []);

  // Wire authenticated user to PostHog person profile
  useEffect(() => {
    if (!session?.user) return;
    const user = session.user as {
      id: string;
      role?: string;
      agencyId?: string;
    };
    analytics.identify(user.id, {
      userRole: user.role,
      agencyId: user.agencyId,
    });
  }, [session?.user]);

  return <>{children}</>;
}
