// Shared "return to where you came from" helper for the settings areas
// (critique #187). The main app records the last non-settings page you were on;
// the Back links in the settings shells read it, so Back takes you back to that
// page rather than always dumping you on the hub. Pure client util (sessionStorage).

export const RETURN_PATH_KEY = "tsp:return-to";

// Pages that ARE the settings area — we never record these as a "return to"
// target (otherwise Back would loop you between settings tabs).
export function isSettingsPath(p: string): boolean {
  return (
    p.startsWith("/agent/settings") ||
    p.startsWith("/agent/account") ||
    p === "/agent/team" ||
    p.startsWith("/command/settings")
  );
}

export function recordAppPath(p: string): void {
  if (typeof window === "undefined" || !p || isSettingsPath(p)) return;
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, p);
  } catch {
    /* sessionStorage unavailable (private mode) — Back just falls back to the hub */
  }
}

export function readReturnPath(fallback = "/agent/hub"): string {
  if (typeof window === "undefined") return fallback;
  try {
    return sessionStorage.getItem(RETURN_PATH_KEY) || fallback;
  } catch {
    return fallback;
  }
}
