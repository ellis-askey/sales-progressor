// Hand-written personality + suitability for each family (the REAL collections +
// the current-app baseline). Merged at render time with the generated
// license/palette/coverage from realIcons.generated.ts.

export type Suit = "strong" | "ok" | "weak";
export type Recommend = "tsp-wide" | "selective" | "accents";

export type FamilyMeta = {
  personality: string;
  small: Suit; // small action buttons (16px)
  nav: Suit;
  status: Suit;
  dense: Suit; // dense dashboards
  tone: "professional" | "between" | "playful";
  recommend: Recommend;
  note: string;
};

// Display order: baseline, then mono families, then colour families.
export const FAMILY_ORDER = [
  "current",
  "solar-duotone", "mingcute-fill", "remix-fill", "iconpark-twotone", "plump", "hugeicons",
  "iconpark-color", "plump-color", "kameleon", "fluent-color", "fe-flat", "fe-3d",
];

export const FAMILY_META: Record<string, FamilyMeta> = {
  current: {
    personality: "Our icons today: thin, neutral outlines (Phosphor regular). The baseline to beat.",
    small: "strong", nav: "strong", status: "ok", dense: "strong", tone: "professional",
    recommend: "tsp-wide", note: "What ships now. Shown for comparison.",
  },
  "solar-duotone": {
    personality: "Rounded shapes with a soft tinted fill behind a bold outline. Warm, premium, calm — mono but with depth.",
    small: "ok", nav: "strong", status: "strong", dense: "ok", tone: "professional",
    recommend: "tsp-wide", note: "Strong fit for 'expressive + rounded + grown-up'. Single-hue, so it still tints to the TSP coral.",
  },
  "mingcute-fill": {
    personality: "Clean rounded solids. Confident, modern, extremely legible at every size.",
    small: "strong", nav: "strong", status: "strong", dense: "strong", tone: "professional",
    recommend: "tsp-wide", note: "The safest filled upgrade. Reads heavier than our line icons but stays professional.",
  },
  "remix-fill": {
    personality: "Neutral rounded solids, a touch more geometric than MingCute. Understated and dependable.",
    small: "strong", nav: "strong", status: "strong", dense: "strong", tone: "professional",
    recommend: "tsp-wide", note: "Very complete, very neutral. A quiet filled option if MingCute feels too soft.",
  },
  "iconpark-twotone": {
    personality: "Black outline plus a single accent fill. Crisp, a little techy and graphic.",
    small: "ok", nav: "strong", status: "strong", dense: "ok", tone: "between",
    recommend: "selective", note: "The accent is baked per icon; would need theming to sit on coral consistently.",
  },
  plump: {
    personality: "Chunky, rounded, characterful mono. Expressive without any colour — friendly but not childish.",
    small: "ok", nav: "ok", status: "strong", dense: "ok", tone: "between",
    recommend: "tsp-wide", note: "The closest match to 'rounded + characterful' while staying mono. Streamline is freemium.",
  },
  hugeicons: {
    personality: "Rounded stroke icons — like our current line but softer and friendlier. The gentlest refresh.",
    small: "strong", nav: "strong", status: "ok", dense: "strong", tone: "professional",
    recommend: "tsp-wide", note: "Lowest-risk change from today. Free set is a subset of the full (paid) library.",
  },
  "iconpark-color": {
    personality: "Flat multicolour outline. Lively and approachable but still restrained — colour used sparingly.",
    small: "weak", nav: "ok", status: "strong", dense: "weak", tone: "between",
    recommend: "selective", note: "Best as section/feature marks. Fixed colours ignore the TSP palette.",
  },
  "plump-color": {
    personality: "Chunky multicolour objects. Warm, tactile and expressive — the characterful colour option.",
    small: "weak", nav: "ok", status: "strong", dense: "weak", tone: "playful",
    recommend: "selective", note: "Great personality for empty states / onboarding; busy in dense tables. Freemium.",
  },
  kameleon: {
    personality: "Highly illustrative multicolour pictograms. Maximum personality — leans consumer/playful.",
    small: "weak", nav: "weak", status: "ok", dense: "weak", tone: "playful",
    recommend: "accents", note: "Risks feeling childish for legal/finance. PARTIAL coverage. Freemium.",
  },
  "fluent-color": {
    personality: "Microsoft's modern flat-colour system icons. Polished and product-y, cooler palette.",
    small: "weak", nav: "ok", status: "strong", dense: "weak", tone: "between",
    recommend: "selective", note: "Clean colour marks for features. PARTIAL coverage for our meanings.",
  },
  "fe-flat": {
    personality: "Flat emoji. Very expressive and instantly readable — but unmistakably consumer.",
    small: "weak", nav: "weak", status: "strong", dense: "weak", tone: "playful",
    recommend: "accents", note: "Accents / status only. Not a UI-chrome icon set.",
  },
  "fe-3d": {
    personality: "3D emoji. Dimensional, glossy, marketing-grade. Lovely big, unreadable small.",
    small: "weak", nav: "weak", status: "ok", dense: "weak", tone: "playful",
    recommend: "accents", note: "Empty states / hero moments only. Never in a 16px button.",
  },
};
