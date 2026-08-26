// Local palette for the public outsource landing page. Mirrors the app's light
// "sunset" theme + frosted-glass cards (same approach as app/quote/[token]/ui.ts)
// so the page reads as part of Sales Progressor: iridescent AppBackground with
// translucent glass cards floating over it, warm coral accents, warm-brown ink.

export const A = {
  paper: "#FFFBF5",

  // Frosted-glass card floating over the iridescent AppBackground. Translucent
  // enough that the shimmer reads through; blur + saturate applied via cardBlur.
  cardBg: "rgba(255,255,255,0.58)",
  cardBorder: "rgba(255,255,255,0.60)",
  cardBlur: "blur(24px) saturate(180%)",
  cardShadow: "0 8px 32px rgba(90,58,40,0.10), 0 2px 8px rgba(45,24,16,0.05)",

  // A lighter frost for the top bar.
  barBg: "rgba(255,255,255,0.55)",
  barBlur: "blur(20px) saturate(160%)",
  barBorder: "rgba(255,255,255,0.55)",

  // Ink (warm brown, per the sunset theme).
  textPrimary: "#2D1810",
  textSecondary: "#5A3A28",
  textMuted: "rgba(45,24,16,0.62)",
  textFaint: "rgba(45,24,16,0.42)",

  // Coral accent.
  coral: "#FF8A65",
  coralDeep: "#FF6B4A",
  coralGradient: "linear-gradient(135deg, #FF8A65, #FF6B4A)",

  // Neutral controls.
  inputBg: "rgba(255,255,255,0.85)",
  inputBorder: "rgba(45,24,16,0.14)",

  // Hairline divider inside cards.
  divider: "rgba(45,24,16,0.08)",

  danger: "#A8322F",
  dangerBg: "rgba(199,62,62,0.08)",
  dangerBorder: "rgba(199,62,62,0.28)",
} as const;
