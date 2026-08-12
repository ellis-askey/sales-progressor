/**
 * Single source of truth for valid agent themes.
 * Adding a new theme here AND adding the corresponding [data-theme="..."]
 * block in app/agent/styles/themes.css are the two places that change
 * when shipping a new theme.
 */
import { normaliseHex, DEFAULT_BRAND_HEX } from "./brand-theme";

export const AGENT_THEMES = [
  "sunset",
  "coastal",
  "heritage",
  "slate",
  "emerald",
  "claret",
] as const;

export type AgentTheme = (typeof AGENT_THEMES)[number];

export const DEFAULT_AGENT_THEME: AgentTheme = "sunset";

export function isAgentTheme(value: unknown): value is AgentTheme {
  return typeof value === "string" && (AGENT_THEMES as readonly string[]).includes(value);
}

/**
 * Reads the theme from a user's agentPreferences JSON field.
 * Returns the default theme if no preference is set or the value is invalid.
 */
export function getAgentTheme(agentPreferences: unknown): AgentTheme {
  if (
    agentPreferences &&
    typeof agentPreferences === "object" &&
    "theme" in agentPreferences &&
    isAgentTheme((agentPreferences as Record<string, unknown>).theme)
  ) {
    return (agentPreferences as { theme: AgentTheme }).theme;
  }
  return DEFAULT_AGENT_THEME;
}

// ── Custom brand colour ─────────────────────────────────────────────────────
// The 6 presets are retired in favour of one user-picked brand colour, stored
// as a hex on agentPreferences.brandColor. Users still on a legacy preset map
// to that preset's original accent so nothing changes for them until they pick.

const LEGACY_THEME_HEX: Record<AgentTheme, string> = {
  sunset: "#ff6b4a",
  coastal: "#1f5a6e",
  heritage: "#4a6fb5",
  slate: "#3d4e66",
  emerald: "#2d5a3d",
  claret: "#6e1f2e",
};

/** The user's brand colour: explicit hex if set, else their old preset's
 *  accent, else the classic coral. Always a valid #rrggbb. */
export function getBrandColor(agentPreferences: unknown): string {
  if (agentPreferences && typeof agentPreferences === "object") {
    const prefs = agentPreferences as Record<string, unknown>;
    const explicit = normaliseHex(typeof prefs.brandColor === "string" ? prefs.brandColor : "");
    if (explicit) return explicit;
    if (isAgentTheme(prefs.theme)) return LEGACY_THEME_HEX[prefs.theme];
  }
  return DEFAULT_BRAND_HEX;
}

// ── Mobile themes ─────────────────────────────────────────────────────────────
// Separate theme set for ≤1024px viewports. Heritage is the default and crosses
// over from the desktop set; the other five are mobile-only.

export const MOBILE_AGENT_THEMES = [
  "heritage",
  "sage",
  "dusk",
  "stone",
  "mist",
  "blush",
] as const;

export type MobileAgentTheme = (typeof MOBILE_AGENT_THEMES)[number];

export const DEFAULT_MOBILE_AGENT_THEME: MobileAgentTheme = "heritage";

export function isMobileAgentTheme(value: unknown): value is MobileAgentTheme {
  return typeof value === "string" && (MOBILE_AGENT_THEMES as readonly string[]).includes(value);
}

/**
 * Reads the mobile theme from a user's agentPreferences JSON field.
 * Returns heritage if no preference is set or the value is invalid.
 */
export function getMobileAgentTheme(agentPreferences: unknown): MobileAgentTheme {
  if (
    agentPreferences &&
    typeof agentPreferences === "object" &&
    "mobileTheme" in agentPreferences &&
    isMobileAgentTheme((agentPreferences as Record<string, unknown>).mobileTheme)
  ) {
    return (agentPreferences as { mobileTheme: MobileAgentTheme }).mobileTheme;
  }
  return DEFAULT_MOBILE_AGENT_THEME;
}

// ── Night mode ─────────────────────────────────────────────────────────────────
// null  = auto (client-side time-based: on 22:00–07:00, off otherwise)
// true  = always on (user manually enabled)
// false = always off (user manually disabled, overrides auto)

export function getNightMode(agentPreferences: unknown): boolean | null {
  if (
    agentPreferences &&
    typeof agentPreferences === "object" &&
    "nightMode" in agentPreferences
  ) {
    const val = (agentPreferences as Record<string, unknown>).nightMode;
    if (typeof val === "boolean") return val;
  }
  return null;
}
