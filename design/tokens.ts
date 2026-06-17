/**
 * design/tokens.ts — Read-only mirror of Sales Progressor's CSS design tokens.
 *
 * THIS FILE IS NOT IMPORTED BY COMPONENTS. CSS variables remain the runtime
 * source of truth. Components keep using var(--agent-coral-deep) etc. and read
 * tokens at runtime from themes.css / globals.css / agent-system.css.
 *
 * Purpose of this file: a single grep-able TypeScript surface that future build
 * sessions (and tooling) can scan to discover every visual token at a glance.
 * Identical pattern to ../../cadence-build-package/design/tokens.ts — keeping
 * the shape in sync so anyone working on either app sees the same mental model.
 *
 * Sources mirrored below:
 *   - app/globals.css           — glass surface tokens (Phase-2 opacities)
 *   - app/agent/styles/themes.css — agent app theme tokens (sunset default)
 *   - app/agent/styles/agent-system.css — keyframes, transitions, hover utilities
 *   - docs/reference/MODAL_DRAWER_SYSTEM.md — locked modal/drawer animation spec
 *
 * Lockstep rule: any commit that changes a token in CSS updates this file in
 * the same commit. See docs/DEFINITION_OF_DONE.md.
 */

/* ─── Colour ───────────────────────────────────────────────────────────────── */

export const color = {
  // Agent app — sunset theme (default).
  // For full theme inventory + per-theme overrides see app/agent/styles/themes.css.
  bgBase:        '#FFF5EC',
  bgMid:         '#FFE8D4',
  bgWarm:        '#FFDABD',
  bgDeep:        '#FFCBA4',
  bgPaper:       '#FFFBF5',
  surfaceElevated: '#FFFFFF',

  textPrimary:   '#2D1810',
  textSecondary: '#5A3A28',
  textTertiary:  '#7A4A2E',
  textMuted:     'rgba(45, 24, 16, 0.55)',
  textDisabled:  'rgba(45, 24, 16, 0.35)',
  textOnCoral:   '#FFFFFF',
  textOnDark:    '#FFFBF5',

  coral:         '#FF8A65',
  coralDeep:     '#FF6B4A',   // primary CTA accent — header line, button gradient stop
  coralDarker:   '#E55B3D',
  coralLight:    '#FFB18F',
  coralPale:     '#FFD4C2',
  coralBgTint:        'rgba(255, 138, 101, 0.08)',
  coralBgTintHover:   'rgba(255, 138, 101, 0.14)',

  success:       '#1F8A4A',
  warning:       '#C97D1A',
  danger:        '#C73E3E',
  info:          '#3D7AB8',
  snoozed:       '#7E22CE',

  // Side accents (categorical, theme-locked) — vendor vs purchaser labels.
  vendorAccent:    '#4F46E5',
  purchaserAccent: '#BE185D',

  // Dark-surface label tokens (from globals.css :root, Phase 1a).
  labelPrimaryOnDark:    'rgba(255, 255, 255, 0.92)',
  labelSecondaryOnDark:  'rgba(255, 255, 255, 0.60)',
  labelTertiaryOnDark:   'rgba(255, 255, 255, 0.38)',
  labelQuaternaryOnDark: 'rgba(255, 255, 255, 0.22)',
} as const;

/* ─── Glass surfaces ───────────────────────────────────────────────────────── */

export const glass = {
  // From globals.css — :root tokens used by .glass-card, .glass-panel, .glass-sidebar.
  fill:        'linear-gradient(180deg, rgb(255 255 255 / 0.56) 0%, rgb(255 255 255 / 0.44) 100%)',
  fillStrong:  'linear-gradient(180deg, rgb(255 255 255 / 0.68) 0%, rgb(255 255 255 / 0.56) 100%)',
  border:        'rgb(255 255 255 / 0.35)',
  borderStrong:  'rgb(255 255 255 / 0.50)',
  borderGradient: 'linear-gradient(135deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.15) 50%, rgba(200,220,255,0.30) 100%)',
  highlight:   'inset 2px 2px 12px rgba(255,255,255,0.35), inset -1px -1px 3px rgba(0,0,0,0.04)',
  shadowSm:    '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.06)',
  shadowMd:    '0 2px 4px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.08), 0 16px 48px rgb(0 0 0 / 0.06)',
  shadowLg:    '0 4px 8px rgb(0 0 0 / 0.04), 0 16px 40px rgb(0 0 0 / 0.10), 0 32px 80px rgb(0 0 0 / 0.08)',
  blur:        '40px',
  blurStrong:  '40px',
  saturate:    '200%',
} as const;

/* ─── Borders & focus ──────────────────────────────────────────────────────── */

export const border = {
  subtle:  'rgba(45, 24, 16, 0.06)',
  default: 'rgba(45, 24, 16, 0.10)',
  strong:  'rgba(45, 24, 16, 0.18)',
  focus:   'rgba(255, 138, 101, 0.45)',
} as const;

export const focusRing = {
  base:  '0 0 0 1.5px rgba(255, 138, 101, 0.50), 0 0 12px 2px rgba(255, 138, 101, 0.18)',
  tight: '0 0 0 1px rgba(255, 138, 101, 0.60), 0 0 8px 1px rgba(255, 138, 101, 0.22)',
} as const;

/* ─── Radius (theme-agnostic) ──────────────────────────────────────────────── */

export const radius = {
  sm:   6,
  md:   8,
  lg:  12,
  xl:  16,
  pill: 999,
  // Glass-system radii (from globals.css). Slightly larger than agent radii.
  glassSm: 12,
  glassMd: 16,
  glassLg: 20,
  glassXl: 28,
} as const;

/* ─── Space (4pt base, theme-agnostic) ─────────────────────────────────────── */

export const space = {
  1:  4,
  2:  8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
 10: 40,
 12: 48,
} as const;

/* ─── Shadow ───────────────────────────────────────────────────────────────── */

export const shadow = {
  glass:         '0 4px 20px rgba(255, 138, 101, 0.06), 0 1px 4px rgba(45, 24, 16, 0.04)',
  glassLifted:   '0 8px 32px rgba(255, 138, 101, 0.10), 0 2px 8px rgba(45, 24, 16, 0.06)',
  sidebar:       '2px 0 20px rgba(0, 0, 0, 0.05), 1px 0 0 rgba(228, 233, 240, 0.5)',
} as const;

/* ─── Motion ───────────────────────────────────────────────────────────────── */
//
// Two named choreographies dominate the agent app:
//   - modal-in / drawer-in: 280ms cubic-bezier(0.34, 1.56, 0.64, 1) — spring overshoot
//     (locked by docs/reference/MODAL_DRAWER_SYSTEM.md §6).
//   - reveal-in / dropdown-in / row-flash / row-exit: shorter, calm easing
//     (locked by docs/ANIMATION_STANDARDS.md).
//
// Known outlier: agent-system.css currently ships agent-modal-in at 240ms
// cubic-bezier(0.25,0,0,1) — listed in MODAL_DRAWER_SYSTEM.md as Phase 1-7
// migration target. See docs/DECISIONS.log entry for the canonical timing.

export const motion = {
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  transitionFast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionBase: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionSlow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',

  // Canonical durations
  modalIn:    280, // ms — agent-modal-in / agent-drawer-in (locked spec)
  modalInShipped: 240, // ms — known outlier in agent-system.css, Phase 2 migration
  backdropIn: 200, // ms — agent-backdrop-in
  revealIn:   150, // ms — agent-reveal-in / agent-reveal-out / agent-row-exit
  dropdownIn: 120, // ms — agent-dropdown-in
  rowFlash:   700, // ms — agent-row-flash success wash
  msUnlock:   900, // ms — milestone unlock wash (higher-stakes confirmation)

  // Canonical easings
  springOvershoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // modal / drawer entry
  modalInShippedEase: 'cubic-bezier(0.25, 0, 0, 1)',    // current 240ms outlier
  easeOut: 'ease-out',
  easeIn:  'ease-in',
} as const;

/* ─── Type scale ───────────────────────────────────────────────────────────── */

export const type = {
  display: 32,
  h1:      28,
  h2:      22,
  h3:      17,
  h4:      15,
  body:    14,
  bodySm:  13,
  caption: 12,
  micro:   11,
  eyebrow: 10,

  weight: { regular: 400, medium: 500, semibold: 600 } as const,
  line:   { tight: 1.25, base: 1.50, relaxed: 1.70 } as const,
  tracking: {
    tight:   '-0.01em',
    normal:  '0em',
    wide:    '0.02em',
    eyebrow: '0.05em',
  } as const,
} as const;

/* ─── Z-index ──────────────────────────────────────────────────────────────── */
//
// Modal escalation rule (precedent: commit 5a7cfa0, 2026-06-05):
//   default 50      — most modals (SurveyNrConfirmModal, MortgageModal, etc.)
//   raised  1500    — modal must sit above a page-level overlay (e.g. drawer backdrop)
//   raised  2000    — modal opens on top of another modal (AddBrokerModal / AddFirmModal)
//
// themes.css separately declares --agent-z-modal: 1000 / --agent-z-dropdown: 1500
// / --agent-z-toast: 2000 as theme-agnostic tokens. The modal escalation rule
// above is the operational one; the 1000 token is currently unused by modal code.

export const zIndex = {
  // Theme-token values (from themes.css). Theme-agnostic.
  base:     0,
  elevated: 10,
  overlay:  100,
  modalToken:    1000, // --agent-z-modal token; not currently consumed by modals
  dropdownToken: 1500, // --agent-z-dropdown token; matches "raised modal" rung
  toastToken:    2000, // --agent-z-toast token; matches "deep modal" rung

  // Modal escalation rule values (as built).
  modalDefault: 50,
  modalRaised:  1500,
  modalDeep:    2000,

  // Exchange celebration (one-off overlay).
  exchangeCelebration: 200,
} as const;

/* ─── Hover / interactive state tints ──────────────────────────────────────── */

export const hover = {
  tint:        'rgba(255, 138, 101, 0.10)',
  tintStrong:  'rgba(255, 138, 101, 0.18)',
  tintWarning: 'rgba(254, 215, 170, 0.55)',
} as const;
