// Custom glass styles — Ellis designs a surface live in the Design Lab, names
// it, and saves it. A saved style is a named RECIPE (the glass properties).
// Rendering stays class-based: each style compiles to a `glass-cs-<id>` CSS
// rule (generated + injected by GlassPicksProvider), so a pick can reference a
// style id exactly like a built-in variant id — classFor("cs-ab12") →
// "glass-cs-ab12". No new render path in GlassCard/useGlassTag.
//
// Storage is per-user on agentPreferences.glassStyles (no migration). "For
// everybody" happens the same way picks do today: Export JSON → bake into
// DEFAULT_STYLES / DEFAULT_PICKS page by page.

// Apple-glass refraction overlays, ported from the /dev/glass-foundry materials
// (frost / clear / edge-lit). Each slot maps to one pseudo-element on the glass
// surface, so a surface gets at most one ::before + one ::after. All optional:
// an absent/`"none"` value emits nothing, so existing recipes are unchanged.
export type GlassTop = "none" | "sheen" | "edge"; // ::before — top gloss / edge-lit rim
export type GlassGlare = "none" | "glare" | "streak"; // ::after — corner specular / diagonal refraction

export type GlassRecipe = {
  /** backdrop-filter blur, px */
  blur: number;
  /** surface tint — rgb triple string "r, g, b" */
  bg: string;
  /** tint opacity 0–1 */
  bgA: number;
  /** backdrop saturate multiplier (1 = none) */
  sat: number;
  /** border width px (0 = no border) */
  borderW: number;
  /** border colour rgb triple */
  borderC: string;
  /** border opacity 0–1 */
  borderA: number;
  /** drop-shadow depth 0–100 */
  shadow: number;
  // ── Apple-glass refraction (all optional; absent = off) ──────────────────────
  /** specular bevel — inset edge highlights + inner rim + bottom inner shade, 0–100 */
  bevel?: number;
  /** ::before overlay — "sheen" top gloss or "edge" bright gradient rim */
  top?: GlassTop;
  /** ::after overlay — "glare" corner specular or "streak" diagonal refraction */
  glare?: GlassGlare;
};

export type GlassStyle = { id: string; name: string; recipe: GlassRecipe };

// App-wide baked custom styles — the "for everybody" half of a Design Lab
// export (DEFAULT_PICKS is the other half). Merged into every user's styles so
// a DEFAULT_PICKS / useGlassTag-baseline entry that references one of these cs-
// ids resolves and renders for all users. A user who forks their own style
// (always a new id) layers on top; these are never mutated in place. Grows as
// Ellis bakes more pages. 2026-10-25.
export const DEFAULT_STYLES: GlassStyle[] = [
  {
    id: "cs-053799eb",
    name: "Dark Frosted Main Everywhere Card",
    recipe: { blur: 60, bg: "255, 255, 255", bgA: 0.06, sat: 1, borderW: 1, borderC: "255, 255, 255", borderA: 0.12, shadow: 22 },
  },
  {
    id: "cs-b7c9ec28",
    name: "Light Main Card",
    recipe: { blur: 50, bg: "255, 255, 255", bgA: 0.5, sat: 1, borderW: 1, borderC: "255, 255, 255", borderA: 0.12, shadow: 30 },
  },
  {
    id: "cs-9049173a",
    name: "Dark Property Hero",
    recipe: { blur: 50, bg: "255, 255, 255", bgA: 0.06, sat: 1, borderW: 1, borderC: "255, 255, 255", borderA: 0.15, shadow: 22 },
  },
];

// The baseline a brand-new custom style starts from — roughly today's plain
// agent card (v00-ish), so "Customise" opens on a sensible surface.
export const DEFAULT_RECIPE: GlassRecipe = {
  blur: 12,
  bg: "255, 255, 255",
  bgA: 0.06,
  sat: 1,
  borderW: 1,
  borderC: "255, 255, 255",
  borderA: 0.12,
  shadow: 22,
};

/** A pick value is a built-in variant ("vNN") or a custom style ("cs-…"). */
export function isCustomStyleId(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("cs-");
}

/** New unique style id (client-side; crypto is available in the Lab). */
export function newStyleId(): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.abs(Math.floor(Math.random() * 1e9)).toString(36);
  return `cs-${rnd}`;
}

function shadowValue(depth: number): string {
  if (depth <= 0) return "none";
  const y = Math.round(depth * 0.18);
  const blur = Math.round(depth * 0.6);
  const a = (depth * 0.004).toFixed(3);
  return `0 ${y}px ${blur}px rgba(15, 23, 42, ${a})`;
}

/** The CSS declaration body for a recipe (no selector).
 *
 *  blur (backdrop-filter) and shadow carry `!important` on purpose. A custom
 *  style is an explicit, deliberate pick, so it must win over the cards-on-cards
 *  nesting strip in glass.css — `[data-glass-id] [data-glass-id] { backdrop-
 *  filter: none !important; box-shadow: none !important }` — which otherwise
 *  force-kills blur + shadow on any tagged card nested inside another (e.g. the
 *  Hub "Needs your attention" card). That strip leaves background + border
 *  alone, which is why tint/border always applied but blur/shadow didn't. Our
 *  `<style data-glass-custom>` is injected after glass.css (document order), so
 *  at equal specificity + importance the custom rule wins. Background + border
 *  stay un-important so normal hover states still layer over them. */
// Refraction is expressed entirely through `background` layers + `box-shadow`
// (no pseudo-elements, no position/overflow changes) so it layers onto ANY
// tagged surface without disturbing its layout — a glass rule that forced
// `position: relative` would break the modal's `position: absolute` centring.
// Gradient layers always paint behind content, so no z-index juggling either.

/** Specular bevel as inset box-shadow layers (empty when off). Scales the
 *  /dev/glass-foundry .gf-disp craft: top highlight + inner rim + bottom shade. */
function bevelInsets(bevel: number | undefined): string[] {
  const s = Math.min(100, Math.max(0, bevel ?? 0)) / 100;
  if (s <= 0) return [];
  return [
    `0 1px 0 rgba(255,255,255,${(0.5 * s).toFixed(3)}) inset`,
    `0 0 0 0.5px rgba(255,255,255,${(0.22 * s).toFixed(3)}) inset`,
    `0 -14px 26px rgba(0,0,0,${(0.22 * s).toFixed(3)}) inset`,
  ];
}

/** Edge-lit bright rim (gf-edge) as inset box-shadow layers. */
function edgeRimInsets(r: GlassRecipe): string[] {
  if (r.top !== "edge") return [];
  return [
    "0 0 0 1px rgba(255,255,255,0.14) inset",
    "0 1.5px 1px rgba(255,255,255,0.55) inset",
    "0 -2px 2px rgba(255,255,255,0.15) inset",
  ];
}

/** Refraction glare/sheen as translucent `background` gradient layers (gf-frost
 *  top gloss, gf-edge corner glare, gf-clear diagonal streak). Painted over the
 *  base tint, which is appended last by the caller. */
function gradientLayers(r: GlassRecipe): string[] {
  const g: string[] = [];
  if (r.top === "sheen") g.push("linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 42%)");
  if (r.glare === "glare") g.push("radial-gradient(120% 80% at 30% 6%, rgba(255,255,255,0.26), transparent 44%)");
  else if (r.glare === "streak") g.push("linear-gradient(135deg, rgba(255,255,255,0.22), transparent 40%)");
  return g;
}

export function recipeToCssBody(r: GlassRecipe): string {
  const bf = `blur(${r.blur}px) saturate(${r.sat})`;
  const border = r.borderW > 0 ? `${r.borderW}px solid rgba(${r.borderC}, ${r.borderA})` : "none";
  const outer = shadowValue(r.shadow);
  const shadows = [...bevelInsets(r.bevel), ...edgeRimInsets(r), ...(outer === "none" ? [] : [outer])];
  const boxShadow = shadows.length ? shadows.join(", ") : "none";
  const tint = `rgba(${r.bg}, ${r.bgA})`;
  const layers = gradientLayers(r);
  const background = layers.length ? `${layers.join(", ")}, ${tint}` : tint;
  return [
    `  background: ${background};`,
    `  -webkit-backdrop-filter: ${bf} !important;`,
    `  backdrop-filter: ${bf} !important;`,
    `  border: ${border};`,
    `  box-shadow: ${boxShadow} !important;`,
  ].join("\n");
}

/** CSS rule for a recipe at a selector. Shared by saved styles + the live editor
 *  preview so both render alike. */
export function recipeCssRules(selector: string, r: GlassRecipe): string {
  return `${selector} {\n${recipeToCssBody(r)}\n}`;
}

/** Full stylesheet body for a set of custom styles. Scoped `[data-glass-id]`
 *  to match the variant specificity boost so it wins over bespoke surfaces. */
export function glassStylesCss(styles: GlassStyle[]): string {
  return styles
    .map((s) => recipeCssRules(`[data-glass-id].glass-${s.id}`, s.recipe))
    .join("\n");
}

// Validate/sanitise stored styles (defensive against malformed JSON).
export function parseGlassStyles(raw: unknown): GlassStyle[] {
  if (!Array.isArray(raw)) return [];
  const out: GlassStyle[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (!isCustomStyleId(o.id) || typeof o.name !== "string") continue;
    const r = (o.recipe ?? {}) as Record<string, unknown>;
    const num = (v: unknown, fb: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, typeof v === "number" && isFinite(v) ? v : fb));
    const rgb = (v: unknown, fb: string) => (typeof v === "string" && /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(v.trim()) ? v.trim() : fb);
    const top: GlassTop = r.top === "sheen" || r.top === "edge" ? r.top : "none";
    const glare: GlassGlare = r.glare === "glare" || r.glare === "streak" ? r.glare : "none";
    out.push({
      id: o.id,
      name: o.name.slice(0, 40),
      recipe: {
        blur: num(r.blur, DEFAULT_RECIPE.blur, 0, 80),
        bg: rgb(r.bg, DEFAULT_RECIPE.bg),
        bgA: num(r.bgA, DEFAULT_RECIPE.bgA, 0, 1),
        sat: num(r.sat, DEFAULT_RECIPE.sat, 0, 3),
        borderW: num(r.borderW, DEFAULT_RECIPE.borderW, 0, 6),
        borderC: rgb(r.borderC, DEFAULT_RECIPE.borderC),
        borderA: num(r.borderA, DEFAULT_RECIPE.borderA, 0, 1),
        shadow: num(r.shadow, DEFAULT_RECIPE.shadow, 0, 100),
        bevel: num(r.bevel, 0, 0, 100),
        top,
        glare,
      },
    });
  }
  return out;
}
