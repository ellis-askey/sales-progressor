// Shared portal design tokens and primitive components

import type { ReactNode } from "react";

// Colour tokens resolve through `var(--portal-*, <hex>)`: the hex fallback IS
// the light theme, so nothing changes unless a theme defines overrides. Dark
// mode + the client's accent are applied by defining those variables on the
// document root (see globals.css + PortalSettingsProvider, Batch 4). Shadows +
// radii stay literal; dark cards get their definition from the themed border.
export const P = {
  pageBg:       "var(--portal-pageBg, #F8F9FB)",
  cardBg:       "var(--portal-cardBg, #FFFFFF)",
  cardElevated: "var(--portal-cardElevated, #FFFFFF)",
  border:       "var(--portal-border, rgba(15,23,42,0.06))",
  borderSubtle: "var(--portal-borderSubtle, rgba(15,23,42,0.04))",

  heroGradient: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
  heroGlow:     "0 8px 32px rgba(255,138,101,0.30)",

  primary:      "var(--portal-primary, #FF6B4A)",
  primaryBg:    "var(--portal-primaryBg, rgba(255,107,74,0.10))",
  primaryText:  "var(--portal-primaryText, #CC4A2E)",

  accent:       "var(--portal-accent, #3B82F6)",
  accentBg:     "var(--portal-accentBg, rgba(59,130,246,0.08))",

  success:      "var(--portal-success, #10B981)",
  successBg:    "var(--portal-successBg, rgba(16,185,129,0.10))",
  warning:      "var(--portal-warning, #F59E0B)",
  warningBg:    "var(--portal-warningBg, rgba(245,158,11,0.10))",

  textPrimary:   "var(--portal-textPrimary, #1A1D29)",
  textSecondary: "var(--portal-textSecondary, #4A5162)",
  textMuted:     "var(--portal-textMuted, #8B91A3)",

  shadowSm:  "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
  shadowMd:  "0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)",
  shadowLg:  "0 12px 32px rgba(15,23,42,0.08), 0 4px 8px rgba(15,23,42,0.04)",
  shadowXl:  "0 20px 48px rgba(15,23,42,0.10), 0 8px 16px rgba(15,23,42,0.06)",

  radiusSm:  "12px",
  radiusMd:  "16px",
  radiusLg:  "20px",
  radiusXl:  "28px",

  // Compatibility aliases — removed after full rollout (Phase 6 gate)
  card:         "var(--portal-cardBg, #FFFFFF)",
  bg:           "var(--portal-pageBg, #F8F9FB)",
  shadow:       "0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)",
  primaryLight: "var(--portal-accentBg, rgba(59,130,246,0.08))",
  primaryDark:  "var(--portal-primaryDark, #2563eb)",
  successLight: "var(--portal-successBg, rgba(16,185,129,0.10))",
  successBorder:"var(--portal-successBorder, rgba(16,185,129,0.25))",
  warningLight: "var(--portal-warningBg, rgba(245,158,11,0.10))",
} as const;

// ── 2026-08-15 revamp — button + pill design values (chosen in /test/portal-lab) ──

// PRIMARY-A3 (tactile coral) + COMMS-C2 (solid green / solid blue). Single
// source so every button matches; the interaction states live in globals.css
// (.pbtn / .pbtn-primary / .pbtn-press).
export const PORTAL_BTN = {
  primaryBg:     "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)",
  primaryShadow: "0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,0.30), inset 0 1px 0 rgba(255,255,255,0.30)",
  waBg:          "linear-gradient(180deg,#2ED974 0%,#1FAE53 100%)",
  waShadow:      "0 1px 2px rgba(31,174,83,0.4), 0 6px 14px rgba(37,211,102,0.24), inset 0 1px 0 rgba(255,255,255,0.3)",
  emailBg:       "linear-gradient(180deg,#2A93FF 0%,#0A6FE8 100%)",
  emailShadow:   "0 1px 2px rgba(0,96,223,0.4), 0 6px 14px rgba(10,132,255,0.24), inset 0 1px 0 rgba(255,255,255,0.3)",
} as const;

// PILL-P3 (hairline glass): white fill, 0.5px coloured border, coloured dot +
// text. Colour-named tones so the same pill reads consistently everywhere it
// appears (Coming up, hero, timeline, next-action). `neutral` drops the dot for
// plain attributes (Freehold / Mortgage).
export type PortalPillTone = "coral" | "blue" | "green" | "amber" | "grey" | "neutral";

const PORTAL_PILL_TONES: Record<PortalPillTone, { fg: string; accent: string; dot: boolean }> = {
  coral:   { fg: "#CC4A2E", accent: "#FF6B4A", dot: true },
  blue:    { fg: "#0060DF", accent: "#0A84FF", dot: true },
  green:   { fg: "#047857", accent: "#10B981", dot: true },
  amber:   { fg: "#B45309", accent: "#F59E0B", dot: true },
  grey:    { fg: "#6B7280", accent: "#9CA3AF", dot: true },
  neutral: { fg: "#4A5162", accent: "rgba(15,23,42,0.18)", dot: false },
};

export function PortalPill({ tone = "neutral", size = "sm", children }: {
  tone?: PortalPillTone;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const t = PORTAL_PILL_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "md" ? "5px 12px" : "4px 11px",
        borderRadius: 999,
        fontSize: size === "md" ? 12 : 11,
        fontWeight: 600,
        color: t.fg,
        background: "#fff",
        border: `0.5px solid ${t.accent}`,
        boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
        whiteSpace: "nowrap",
      }}
    >
      {t.dot && <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: t.accent }} />}
      {children}
    </span>
  );
}

// Milestone groupings — defines how steps are visually bucketed on the progress page
export const VENDOR_GROUPS = [
  { label: "Onboarding",          icon: "👋", codes: ["VM1", "VM2", "VM3", "VM4"] },
  { label: "Contract Preparation",icon: "📝", codes: ["VM5", "VM6", "VM7", "VM8", "VM9"] },
  { label: "Enquiries",           icon: "💬", codes: ["VM10", "VM21"] },
  { label: "Ready to Exchange",   icon: "🔑", codes: ["VM16", "VM17", "VM18"] },
  { label: "After Exchange",      icon: "🎉", codes: ["VM19", "VM20"] },
];

export const PURCHASER_GROUPS = [
  { label: "Onboarding",         icon: "👋", codes: ["PM1", "PM2", "PM3", "PM4"] },
  { label: "Your Mortgage",      icon: "🏦", codes: ["PM5", "PM6", "PM11"] },
  { label: "Survey",             icon: "🔍", codes: ["PM9", "PM10"] },
  { label: "Searches & Legal",   icon: "⚖️",  codes: ["PM7", "PM8", "PM12", "PM13"] },
  { label: "Enquiries",          icon: "💬", codes: ["PM14", "PM20", "PM21"] },
  { label: "Ready to Exchange",  icon: "🔑", codes: ["PM22", "PM23", "PM24", "PM25"] },
  { label: "After Exchange",     icon: "🎉", codes: ["PM26", "PM27"] },
];
