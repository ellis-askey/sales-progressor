/**
 * Single source of truth for valid agent themes.
 * Adding a new theme here AND adding the corresponding [data-theme="..."]
 * block in app/agent/styles/themes.css are the two places that change
 * when shipping a new theme.
 */
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
