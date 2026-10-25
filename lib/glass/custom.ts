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
export function recipeToCssBody(r: GlassRecipe): string {
  const bf = `blur(${r.blur}px) saturate(${r.sat})`;
  const border = r.borderW > 0 ? `${r.borderW}px solid rgba(${r.borderC}, ${r.borderA})` : "none";
  return [
    `  background: rgba(${r.bg}, ${r.bgA});`,
    `  -webkit-backdrop-filter: ${bf} !important;`,
    `  backdrop-filter: ${bf} !important;`,
    `  border: ${border};`,
    `  box-shadow: ${shadowValue(r.shadow)} !important;`,
  ].join("\n");
}

/** Full stylesheet body for a set of custom styles. Scoped `[data-glass-id]`
 *  to match the variant specificity boost so it wins over bespoke surfaces. */
export function glassStylesCss(styles: GlassStyle[]): string {
  return styles
    .map((s) => `[data-glass-id].glass-${s.id} {\n${recipeToCssBody(s.recipe)}\n}`)
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
      },
    });
  }
  return out;
}
