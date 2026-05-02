// Consent storage for cookie preferences.
// All writes go to localStorage (source of truth) + a plain cookie (SSR read-ahead).
// Dispatches "consent-updated" CustomEvent so PostHogProvider can react without polling.

const STORAGE_KEY = "cookie-consent";
const COOKIE_NAME = "cookie-consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export type ConsentState = {
  decided: boolean;
  analytics: boolean;
};

export function getConsent(): ConsentState {
  if (typeof window === "undefined") {
    return { decided: false, analytics: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { decided: false, analytics: false };
    const parsed = JSON.parse(raw) as { analytics: boolean };
    return { decided: true, analytics: Boolean(parsed.analytics) };
  } catch {
    return { decided: false, analytics: false };
  }
}

export function setConsent(analytics: boolean): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, decidedAt: Date.now() }));

  // Plain cookie so middleware / SSR can detect a decision was made (no JS needed)
  document.cookie = `${COOKIE_NAME}=${analytics ? "accepted" : "declined"}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

  window.dispatchEvent(new CustomEvent("consent-updated", { detail: { analytics } }));
}

export function hasDecided(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
