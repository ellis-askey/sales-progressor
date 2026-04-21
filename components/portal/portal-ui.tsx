// Shared portal design tokens and primitive components

export const P = {
  bg:            "#F7F8FC",
  card:          "#FFFFFF",
  border:        "#E8ECF2",
  primary:       "#3a7bd5",
  primaryLight:  "#EBF2FF",
  primaryDark:   "#2f65b5",
  success:       "#16A34A",
  successLight:  "#F0FDF4",
  successBorder: "#BBF7D0",
  warning:       "#D97706",
  warningLight:  "#FFFBEB",
  textPrimary:   "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  shadow:        "0 1px 6px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
  shadowSm:      "0 1px 4px rgba(0,0,0,0.06)",
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
