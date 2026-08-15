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

  // Card surface — translucent white for a soft glass read over the gradient.
  cardBg: "rgba(255,255,255,0.78)",
  cardBorder: "rgba(45,24,16,0.07)",
  cardShadow: "0 4px 20px rgba(255,138,101,0.08), 0 1px 4px rgba(45,24,16,0.05)",

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
