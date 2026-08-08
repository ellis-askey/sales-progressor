// Elevra-backgrounds pass, 2026-08-08.
//
// Three-state theme axis: "system" follows the OS preference via
// matchMedia; "light" and "dark" are explicit overrides. Persisted per-user
// on User.agentPreferences.themeMode (JSON key).

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"] as const;

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "system" || v === "light" || v === "dark";
}

// Server-safe reader — accepts the raw agentPreferences JSON value and
// returns the stored themeMode or the default. Never throws.
export function readThemeModeFromPrefs(prefs: unknown): ThemeMode {
  if (prefs && typeof prefs === "object" && "themeMode" in prefs) {
    const m = (prefs as { themeMode: unknown }).themeMode;
    if (isThemeMode(m)) return m;
  }
  return DEFAULT_THEME_MODE;
}
