// Design Lab (Ellis-only) — glass variant catalog + helpers.
// Ported from Elevra's GlassGallery.tsx (cadence-build-package). 2026-08-08.
//
// Numbering preserved from Elevra so "the v18 look" always means the
// same thing in both codebases. v00 is a Sales-Progressor addition:
// it's the current agent-app card look (coral warm, hairline border),
// used as the default when no pick exists in the DB.

export type GlassVariantId =
  | "v00"
  | "v01" | "v02" | "v03" | "v04" | "v05"
  | "v06" | "v07" | "v11" | "v16" | "v20"
  | "v08" | "v09" | "v10" | "v21"
  | "v12" | "v13" | "v14" | "v15"
  | "v17" | "v18" | "v19" | "v22"
  | "v23" | "v24" | "v25" | "v26" | "v27" | "v28";

export const DEFAULT_VARIANT: GlassVariantId = "v00";

const ALL_VARIANT_IDS: ReadonlySet<GlassVariantId> = new Set<GlassVariantId>([
  "v00",
  "v01", "v02", "v03", "v04", "v05",
  "v06", "v07", "v11", "v16", "v20",
  "v08", "v09", "v10", "v21",
  "v12", "v13", "v14", "v15",
  "v17", "v18", "v19", "v22",
  "v23", "v24", "v25", "v26", "v27", "v28",
]);

export function isGlassVariantId(v: unknown): v is GlassVariantId {
  return typeof v === "string" && ALL_VARIANT_IDS.has(v as GlassVariantId);
}

/** Class the CSS in app/styles/glass.css applies via `.glass-vNN`. */
export function classFor(id: GlassVariantId): string {
  return `glass-${id}`;
}

export type GlassVariant = {
  id: GlassVariantId;
  label: string;
  /** One-line "how it's built" — shown in the picker under the name. */
  technique: string;
  /** True when Elevra flagged this as the recommended pick for its family. */
  recommended?: boolean;
  /** Extra "when to use" note shown next to the recommended star. */
  recommendedFor?: string;
};

export type GlassFamily = {
  id: string;
  label: string;
  /** Group intro copy (same as Elevra's description). */
  intro: string;
  /** "Best for" bullets — from Elevra. */
  bestFor: string[];
  /** "Avoid when" bullets — from Elevra. */
  avoid?: string[];
  variants: GlassVariant[];
};

// Elevra's copy verbatim. Order inside each family matches the gallery
// (least-to-most opinionated for Density; recommended first for the rest).
export const GLASS_FAMILIES: readonly GlassFamily[] = [
  {
    id: "baseline",
    label: "Baseline",
    intro:
      "Today's agent-app card. Every tagged card renders as v00 by default until you pick a real variant here.",
    bestFor: ["Leaving a card alone while you focus on others"],
    variants: [
      {
        id: "v00",
        label: "Agent current",
        technique: "surface-elevated · 0.5px hairline · tiny shadow",
        recommended: true,
        recommendedFor: "The default. Same look as today.",
      },
    ],
  },
  {
    id: "density",
    label: "Density",
    intro:
      "Same blur, five background alphas + a solid control. Use this to feel the dial before you reach for any of the other families.",
    bestFor: [
      "Picking the default alpha for cards across the app",
      "A/B against Elevra's current default (v03) without other variables",
      "Deciding \"how much of the aurora should bleed through\"",
    ],
    variants: [
      { id: "v01", label: "Solid baseline",   technique: "solid bg · no blur · hairline" },
      { id: "v02", label: "Faint glass",      technique: "bg 3% · blur 4px" },
      { id: "v04", label: "Thin glass",       technique: "bg 6% · blur 8px" },
      { id: "v03", label: "Standard glass",   technique: "panel bg · blur 12px", recommended: true, recommendedFor: "Elevra's production default. Hard to beat for body-text legibility." },
      { id: "v05", label: "Heavy frost",      technique: "bg 10% · blur 64px" },
    ],
  },
  {
    id: "apple",
    label: "Apple liquid",
    intro:
      "Vibrancy filters + specular edges + saturation boost — the macOS / iOS 26 liquid glass family. Panels take a tint from what's behind them.",
    bestFor: [
      "Hero surfaces (Programme Builder header, Today hero, hero modals)",
      "Premium-feeling cards on landing / marketing surfaces",
      "When the surface should feel like it belongs to the aurora, not over it",
    ],
    avoid: [
      "Dense data grids (saturate-200 over a table reads as noise)",
      "Light-theme surfaces (these tokens were tuned dark)",
    ],
    variants: [
      { id: "v16", label: "Top-edge specular", technique: "1px gradient border + glass body", recommended: true, recommendedFor: "Strong hero candidate. Apple-like depth cue without saturation noise." },
      { id: "v06", label: "Vibrant (macOS)",   technique: "bg 8% · blur 12px · saturate 1.5" },
      { id: "v11", label: "Liquid mercury",    technique: "bg 4% · blur 40px · saturate 1.8" },
      { id: "v07", label: "Hyper-vibrant",     technique: "bg 6% · blur 24px · saturate 2.0" },
      { id: "v20", label: "Crystal",           technique: "bg 12% · blur 24px · top specular border" },
    ],
  },
  {
    id: "tinted",
    label: "Tinted",
    intro:
      "Coloured glass — the surface carries a hue. Reach for it on warn / accent / branded callouts, not on body content.",
    bestFor: [
      "Validation bars",
      "Accent-only callouts (\"new feature\", primary action surfaces)",
      "Hero variants for special programme states",
    ],
    avoid: [
      "Stacking multiple tints on the same screen",
      "Mixing warm + cool tints adjacent",
    ],
    variants: [
      { id: "v10", label: "Accent tint",      technique: "accent 8% · blur 12px · accent hairline", recommended: true, recommendedFor: "Standard for accent callouts." },
      { id: "v08", label: "Cool tint",        technique: "blue 10% · blur 12px" },
      { id: "v09", label: "Warm tint (warn)", technique: "amber 8% · blur 12px" },
      { id: "v21", label: "Slate (dark)",     technique: "black 30% · blur 12px" },
    ],
  },
  {
    id: "bordered",
    label: "Bordered",
    intro:
      "Where the border does the heavy lifting. Best when you want structure without weight.",
    bestFor: [
      "Empty-state cards",
      "Hero bands where the border carries the brand",
      "Modal frames where content is the star",
    ],
    avoid: [
      "Long lists of bordered tiles (frames start to vibrate)",
      "Sub-100px tiles (more border than content)",
    ],
    variants: [
      { id: "v15", label: "Gradient hairline", technique: "1px brand-gradient border + glass body", recommended: true, recommendedFor: "Hero candidate. Brand identity baked into the frame." },
      { id: "v12", label: "Sharp glass",       technique: "bg 10% · blur 12px · 2px white border" },
      { id: "v14", label: "Border-only frame", technique: "transparent · blur 12px · 2px white border" },
      { id: "v13", label: "Pillow glass",      technique: "bg 6% · blur 12px · inner + outer shadow" },
    ],
  },
  {
    id: "decorative",
    label: "Decorative",
    intro:
      "Glass plus something extra (grain, dual-glow, inner glow, iridescent sheen). Use as accents, not defaults.",
    bestFor: [
      "Marketing / landing hero cards",
      "One signature card per screen",
      "Empty states that need a moment of delight",
    ],
    avoid: [
      "Listing cards, data grids, anything repeating (texture becomes noise)",
      "Body-text-heavy surfaces",
    ],
    variants: [
      { id: "v18", label: "Bento dual-glow",  technique: "glass body · two radial highlights", recommended: true, recommendedFor: "Best of the decorative family. Depth without texture noise." },
      { id: "v17", label: "Noise-textured",   technique: "glass body · 8% SVG grain overlay" },
      { id: "v19", label: "Inner glow",       technique: "glass body · inset accent glow" },
      { id: "v22", label: "Iridescent",       technique: "multi-hue diagonal sheen overlay" },
    ],
  },
  {
    id: "bespoke",
    label: "Bespoke",
    intro:
      "Ellis's five hand-picked glassmorphism recipes (2026-08-08). Apple liquid glass, a specular glow bar, masked dual-edge borders, a contrast lens and the classic frost bar — each adapted from its source demo to sit on the app backdrop.",
    bestFor: [
      "Signature cards that need to stand out from the plain frost families",
      "Hero surfaces (liquid glass + masked duo carry the most identity)",
      "Bars and strips (glow bar + classic frost were born as bars)",
    ],
    avoid: [
      "Using every bespoke variant on the same screen (they compete)",
      "Dense data grids under v26 (the contrast punch fights small text)",
    ],
    variants: [
      { id: "v23", label: "Liquid glass",     technique: "white 25% · specular inset · saturate + brighten · springy hover", recommended: true, recommendedFor: "The Apple liquid-glass look. Strong hero + card default." },
      { id: "v24", label: "Specular glow bar", technique: "inner glow ring · mirrored radial sheen layers" },
      { id: "v25", label: "Masked duo edge",   technique: "white edge top-left + coral edge bottom-right, opposing masks" },
      { id: "v26", label: "Contrast lens",     technique: "blur 24px · contrast 1.35 · lens-edge highlight" },
      { id: "v27", label: "Classic frost bar", technique: "white 15% · blur 8px · 18% hairline · deep soft shadow" },
      { id: "v28", label: "Contrast lens · nav blur", technique: "v26 contrast lens · blur 8px (Elevra mobile tab bar)" },
    ],
  },
];

/** Flat lookup — variant by ID (or undefined). */
export function findVariantMeta(id: GlassVariantId): GlassVariant | undefined {
  for (const family of GLASS_FAMILIES) {
    for (const v of family.variants) {
      if (v.id === id) return v;
    }
  }
  return undefined;
}
