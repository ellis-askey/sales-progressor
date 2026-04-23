// Shared portal design tokens and primitive components

export const P = {
  pageBg:       "#F8F9FB",
  cardBg:       "#FFFFFF",
  cardElevated: "#FFFFFF",
  border:       "rgba(15,23,42,0.06)",
  borderSubtle: "rgba(15,23,42,0.04)",

  heroGradient: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
  heroGlow:     "0 8px 32px rgba(255,138,101,0.30)",

  primary:      "#FF6B4A",
  primaryBg:    "rgba(255,107,74,0.10)",
  primaryText:  "#CC4A2E",

  accent:       "#3B82F6",
  accentBg:     "rgba(59,130,246,0.08)",

  success:      "#10B981",
  successBg:    "rgba(16,185,129,0.10)",
  warning:      "#F59E0B",
  warningBg:    "rgba(245,158,11,0.10)",

  textPrimary:   "#1A1D29",
  textSecondary: "#4A5162",
  textMuted:     "#8B91A3",

  shadowSm:  "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
  shadowMd:  "0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)",
  shadowLg:  "0 12px 32px rgba(15,23,42,0.08), 0 4px 8px rgba(15,23,42,0.04)",
  shadowXl:  "0 20px 48px rgba(15,23,42,0.10), 0 8px 16px rgba(15,23,42,0.06)",

  radiusSm:  "12px",
  radiusMd:  "16px",
  radiusLg:  "20px",
  radiusXl:  "28px",

  // Compatibility aliases — removed after full rollout (Phase 6 gate)
  card:         "#FFFFFF",
  bg:           "#F8F9FB",
  shadow:       "0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)",
  primaryLight: "rgba(59,130,246,0.08)",
  primaryDark:  "#2563eb",
  successLight: "rgba(16,185,129,0.10)",
  successBorder:"rgba(16,185,129,0.25)",
  warningLight: "rgba(245,158,11,0.10)",
} as const;

// Milestone groupings — defines how steps are visually bucketed on the progress page
export const VENDOR_GROUPS = [
  { label: "Onboarding",           icon: "👋", codes: ["VM1", "VM2", "VM3"] },
  { label: "Identity & Documents", icon: "📋", codes: ["VM14", "VM15", "VM4"] },
  { label: "Contract Preparation", icon: "📝", codes: ["VM5", "VM6", "VM7"] },
  { label: "Enquiries",            icon: "💬", codes: ["VM16", "VM17", "VM8", "VM18", "VM19", "VM9"] },
  { label: "Ready to Exchange",    icon: "🔑", codes: ["VM10", "VM11", "VM20"] },
  { label: "After Exchange",       icon: "🎉", codes: ["VM12", "VM13"] },
];

export const PURCHASER_GROUPS = [
  { label: "Onboarding",           icon: "👋", codes: ["PM1", "PM2", "PM14a", "PM15a"] },
  { label: "Your Mortgage",        icon: "🏦", codes: ["PM4", "PM5", "PM6"] },
  { label: "Survey",               icon: "🔍", codes: ["PM7", "PM20"] },
  { label: "Searches & Legal",     icon: "⚖️",  codes: ["PM3", "PM9", "PM8", "PM10"] },
  { label: "Enquiries",            icon: "💬", codes: ["PM11", "PM21", "PM22", "PM12", "PM23", "PM24", "PM25", "PM26"] },
  { label: "Ready to Exchange",    icon: "🔑", codes: ["PM13", "PM14b", "PM15b", "PM27"] },
  { label: "After Exchange",       icon: "🎉", codes: ["PM16", "PM17"] },
];
