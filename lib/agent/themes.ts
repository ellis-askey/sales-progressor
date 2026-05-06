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
 *
 * Use this everywhere the theme needs to be resolved — never reach into
 * agentPreferences directly elsewhere in the codebase.
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
