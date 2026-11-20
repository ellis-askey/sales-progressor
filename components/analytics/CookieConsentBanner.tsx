"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getConsent, setConsent, type ConsentState } from "@/lib/analytics/consent";
import { CookieConsent } from "@/components/arc/cookie-consent/cookie-consent";
import "@/components/arc/cookie-consent/scope.css";

// The uiarc.dev CookieConsent (MIT) is the canonical banner — a single surface
// that morphs bar → preferences → reopen button. We keep its UX verbatim and
// wire it to OUR consent store (lib/analytics/consent.ts): the choice is read
// from getConsent() to seed the component, and written through setConsent() on
// change — which persists localStorage + the SSR cookie, posts the audit record
// and fires the "consent-updated" event PostHogProvider listens for. Nothing
// about our consent plumbing or analytics gating changes.
//
// The arc component reads arc design tokens; it's wrapped in `.arc-scope` and
// fed a scoped token file (NOT foundation.css, which carries global focus
// resets). The fixed layer still inherits the tokens through the DOM.

// White-label surfaces where TSP's consent banner must never appear: the
// Boardwalk Forms workspace and its public respondent forms run no analytics
// and must not read as Sales Progressor.
const WHITE_LABEL_PREFIXES = ["/boardwalk", "/f/"];

// Only the cookies we actually set — essential + analytics. We deliberately do
// NOT show the uiarc defaults (Preferences, Marketing): asking consent for
// cookies we don't use would be non-compliant (ICO). Required categories are
// always on; refusing analytics is one tap (Essential only), equal in weight to
// Accept all.
const CATEGORIES = [
  { id: "necessary", label: "Essential", description: "Sign-in, session state and security. The site can't work without these.", required: true },
  { id: "analytics", label: "Analytics", description: "Helps us understand product usage. We use PostHog (EU-hosted), aggregate only. No cross-site tracking." },
];

const LABELS = {
  message: "Essential cookies keep you signed in. Analytics cookies (optional) help us improve the product.",
  customize: "Manage",
  acceptAll: "Accept all",
  rejectAll: "Essential only",
  save: "Save preferences",
  preferencesTitle: "Manage cookies",
  preferencesDescription: "Choose which optional cookies we can use. You can change this any time.",
  reopen: "Cookie settings",
  alwaysOn: "Always on",
  close: "Close",
};

export function CookieConsentBanner() {
  const pathname = usePathname();
  // Read our stored choice on the client only, so a decided visitor never sees
  // the bar flash (null = not read yet → render nothing).
  const [consent, setConsentStateLocal] = useState<ConsentState | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    setConsentStateLocal(getConsent());
    // The solicitor portal's first-visit welcome flags itself pre-paint; hold the
    // banner back so the two never share the screen, then show once it closes.
    const welcomeOpen = document.documentElement.getAttribute("data-welcome-open") === "1";
    setHeld(welcomeOpen);
    if (!welcomeOpen) return;
    const onClosed = () => setHeld(false);
    window.addEventListener("welcome:closed", onClosed);
    return () => window.removeEventListener("welcome:closed", onClosed);
  }, []);

  if (WHITE_LABEL_PREFIXES.some((p) => pathname?.startsWith(p))) return null;
  if (consent === null || held) return null;

  // Seed the component from our store. A non-null value means "decided" — the
  // component shows the reopen button instead of the bar.
  const defaultValue = consent.decided ? { necessary: true, analytics: consent.analytics } : null;

  return (
    <div className="arc-scope">
      <CookieConsent
        categories={CATEGORIES}
        defaultValue={defaultValue}
        onChange={(value) => { if (value) setConsent(Boolean(value.analytics)); }}
        policy={{ label: "Cookie policy", href: "/cookie-policy" }}
        labels={LABELS}
        position="bottom-right"
        showReopenButton
      />
    </div>
  );
}
