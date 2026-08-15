// Local palette for the public quote flow. Mirrors the app's light "sunset"
// theme (design/tokens.ts) so this token-authed page reads as part of Sales
// Progressor. Kept inline rather than pulling in the agent CSS system because
// this page renders outside AgentShell (no theme variables loaded).

export const A = {
  // Backgrounds (warm cream gradient stops).
  bgBase: "#FFF5EC",
  bgMid: "#FFE8D4",
  bgWarm: "#FFDABD",
  paper: "#FFFBF5",

  // Card surface — frosted glass floating over the app's iridescent backdrop
  // (AppBackground). Translucent enough that the shimmer reads through; the
  // blur + saturate are applied inline as `cardBlur`.
  cardBg: "rgba(255,255,255,0.58)",
  cardBorder: "rgba(255,255,255,0.60)",
  cardBlur: "blur(24px) saturate(180%)",
  cardShadow: "0 8px 32px rgba(90,58,40,0.10), 0 2px 8px rgba(45,24,16,0.05)",

  // Ink (warm brown, per the sunset theme).
  textPrimary: "#2D1810",
  textSecondary: "#5A3A28",
  textMuted: "rgba(45,24,16,0.62)",
  textFaint: "rgba(45,24,16,0.42)",

  // Coral accent.
  coral: "#FF8A65",
  coralDeep: "#FF6B4A",
  coralDark: "#CC4A2E",
  coralGradient: "linear-gradient(135deg, #FF8A65, #FF6B4A)",
  coralTint: "rgba(255,138,101,0.09)",
  coralTintBorder: "#FF6B4A",

  // Neutral controls.
  inputBg: "#FFFFFF",
  inputBorder: "rgba(45,24,16,0.14)",

  // Feedback.
  dangerBg: "rgba(199,62,62,0.08)",
  dangerBorder: "rgba(199,62,62,0.28)",
  danger: "#A8322F",
} as const;
