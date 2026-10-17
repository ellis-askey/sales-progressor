// Custom brand-colour engine.
//
// The agent app used to ship 6 hand-tuned preset themes. This replaces that
// with a single user-picked brand colour: everything the accent touches
// (buttons, links, focus rings, the ambient glow, the "up next" tints) is
// derived from that one hex, while the glass cards, the near-white surfaces,
// the semantic red/amber/green, and all spacing/type stay fixed.
//
// deriveBrandVars(hex) returns a map of --agent-* custom properties to inject
// on the shell root. brandThemeCss(hex) wraps that into a <style> body with a
// dark-mode variant, so the dark toggle still works (a lightened accent on the
// fixed dark surfaces). Nothing here reads the DOM — it runs at render time on
// the server, so first paint is already the user's colour.

// ── Colour maths (no deps) ──────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function normaliseHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHex({ r, g, b }: RGB): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const ss = s / 100, ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function hexToHsl(hex: string): HSL { return rgbToHsl(hexToRgb(hex)); }
function hslToHex(hsl: HSL): string { return rgbToHex(hslToRgb(hsl)); }

function withL(hsl: HSL, l: number): string { return hslToHex({ ...hsl, l: clamp(l, 0, 100) }); }
function shiftL(hsl: HSL, delta: number): string { return withL(hsl, hsl.l + delta); }
function rgbTriple(hex: string): string { const { r, g, b } = hexToRgb(hex); return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`; }

// Relative luminance for the white-vs-dark text decision on a coloured button.
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ── Derivation ──────────────────────────────────────────────────────────────

export const DEFAULT_BRAND_HEX = "#ff6b4a"; // the classic coral

// The hex a user picks IS the primary button colour (--agent-coral-deep).
// Everything else is a shade of it, or a very light tint for the backgrounds.
function deriveBrandVars(hex: string, dark: boolean): Record<string, string> {
  const base = hexToHsl(hex);
  // In dark mode, lift the accent so it reads on near-black surfaces.
  const accentHsl: HSL = dark ? { ...base, l: clamp(base.l, 52, 70), s: clamp(base.s, 45, 100) } : base;
  const accent = hslToHex(accentHsl);
  const rgb = rgbTriple(accent);
  const textOnAccent = luminance(accent) > 0.58 ? "#1a1512" : "#ffffff";

  const bgHue = base.h;
  const bgSat = clamp(base.s, 0, 30);

  const vars: Record<string, string> = {
    // Brand / accent family (auto gradient = coral-base -> coral-deep, same hue)
    "--agent-coral": shiftL(accentHsl, 8),
    "--agent-coral-deep": accent,
    "--agent-coral-darker": shiftL(accentHsl, -10),
    "--agent-coral-light": shiftL(accentHsl, 20),
    "--agent-coral-pale": withL({ ...accentHsl, s: clamp(accentHsl.s, 0, 70) }, 88),
    "--agent-coral-bg-tint": `rgba(${rgb}, 0.08)`,
    "--agent-coral-bg-tint-hover": `rgba(${rgb}, 0.14)`,
    "--agent-coral-rgb": rgb,
    "--agent-coral-base-rgb": rgbTriple(shiftL(accentHsl, 8)),
    "--agent-text-on-coral": textOnAccent,

    // Focus, from the accent. Hover is deliberately NOT emitted here any
    // more: --agent-hover-tint/-strong stay the neutral lift-bubble values
    // from themes.css (Ellis, 2026-09-18). This engine renders a <style>
    // AFTER the stylesheets, so anything emitted here silently overrides
    // them — a brand-derived hover was the "watered-down primary wash"
    // that survived the whole hover redesign until the blue-primary test
    // exposed it.
    "--agent-border-focus": `rgba(${rgb}, 0.45)`,
    "--agent-focus-ring": `0 0 0 1.5px rgba(${rgb}, 0.50), 0 0 12px 2px rgba(${rgb}, 0.18)`,
    "--agent-focus-ring-tight": `0 0 0 1px rgba(${rgb}, 0.60), 0 0 8px 1px rgba(${rgb}, 0.22)`,

    // Team-avatar chip: a light tint of the brand with dark brand-toned text
    "--agent-avatar-user-start": withL({ ...base, s: clamp(base.s, 0, 55) }, 90),
    "--agent-avatar-user-end": withL({ ...base, s: clamp(base.s, 0, 65) }, 74),
    "--agent-avatar-user-text": withL(base, 26),

    // Ambient "aurora" glow bands (decorative)
    "--agent-aurora-band1": `rgba(${rgb}, 0.20)`,
    "--agent-aurora-band2": `rgba(${rgbTriple(shiftL(accentHsl, 12))}, 0.18)`,
    "--agent-aurora-band3": `rgba(${rgbTriple(shiftL(accentHsl, 24))}, 0.14)`,
  };

  if (!dark) {
    // Light mode: near-white surfaces with just a whisper of the brand hue, so
    // any colour stays clean and text stays readable.
    const bg = (l: number, s = bgSat) => hslToHex({ h: bgHue, s, l });
    vars["--agent-bg-base"] = bg(97);
    vars["--agent-bg-mid"] = bg(94);
    vars["--agent-bg-warm"] = bg(91);
    vars["--agent-bg-deep"] = bg(88);
    vars["--agent-bg-paper"] = bg(99, clamp(bgSat, 0, 18));
    vars["--agent-bg-base-rgb"] = rgbTriple(bg(97));
  }

  return vars;
}

function toCssBody(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");
}

// The <style> body to render on the page for a given brand hex: light values on
// the shell root, dark values under the dark toggle. Scoped to
// [data-theme="custom"] so it overrides the neutral base block, and the dark
// rule outweighs it under <html data-theme="dark">.
// The .nv2-night wrapper (new-v2 form + night-mode portalled drawers/modals)
// hardcodes the coral family to the default orange in globals.css, as a fallback
// for portalled surfaces that render in document.body and so can't inherit the
// shell's tokens. That static value sits ON the wrapper, which beats the brand
// colour it would otherwise inherit — pinning the whole new-sale form to orange
// regardless of the agency's chosen colour. Re-emit just the coral family onto
// .nv2-night so it tracks the brand, without touching its --nv2-* greys.
const CORAL_KEYS = [
  "--agent-coral", "--agent-coral-deep", "--agent-coral-darker", "--agent-coral-light",
  "--agent-coral-pale", "--agent-coral-bg-tint", "--agent-coral-bg-tint-hover",
  "--agent-coral-rgb", "--agent-coral-base-rgb", "--agent-text-on-coral",
];
function coralBody(vars: Record<string, string>): string {
  return CORAL_KEYS.filter((k) => k in vars).map((k) => `  ${k}: ${vars[k]};`).join("\n");
}

export function brandThemeCss(hexInput: string | null | undefined): string {
  const hex = normaliseHex(hexInput ?? "") ?? DEFAULT_BRAND_HEX;
  const light = deriveBrandVars(hex, false);
  const dark = deriveBrandVars(hex, true);
  return [
    `.agent-shell-root[data-theme="custom"], [data-theme="custom"] {`,
    toCssBody(light),
    `}`,
    `:root[data-theme="dark"] .agent-shell-root[data-theme="custom"],`,
    `:root[data-theme="dark"] [data-theme="custom"] {`,
    toCssBody(dark),
    `}`,
    // .nv2-night: the new-v2 form wrapper + night-mode portalled drawers.
    // .lum-ov: the "Log an update" modal's portal root (rendered in
    // document.body, so outside the shell — its coral tokens would otherwise
    // fall back to the hardcoded orange defaults).
    `.nv2-night, .lum-ov {`,
    coralBody(light),
    `}`,
    `:root[data-theme="dark"] .nv2-night, :root[data-theme="dark"] .lum-ov {`,
    coralBody(dark),
    `}`,
  ].join("\n");
}

// ── App Colour config (the App Colour Studio) ────────────────────────────────
// The richer per-user appearance config: the accent (primary) that themes the
// whole app, a secondary brand colour, and a fully designable PRIMARY button
// (fill, text, radius, border incl. a gradient border, depth) plus a secondary-
// button style. Stored on User.agentPreferences.appColour (JSON, no migration).
// deriveBrandVars still drives the accent family from `primary`; appColourVars
// adds the button tokens that .agent-btn-primary/.agent-btn-secondary consume
// (with CSS fallbacks, so an uncustomised user is byte-identical to today).

export type ButtonText = "auto" | "light" | "dark";
export type SecondaryStyle = "ghost" | "soft" | "outline" | "filled";
export type AppColourConfig = {
  primary: string;
  secondary: string;
  shape: { radius: number }; // px — button corner radius (size stays app-managed)
  primaryBtn: {
    fill: "solid" | "gradient";
    gradFrom: string; gradTo: string; angle: number;
    text: ButtonText;
    border: { on: boolean; style: "solid" | "gradient"; width: number; color: string; gradFrom: string; gradTo: string; angle: number };
    shadow: number; // 0–100
  };
  secondaryBtn: { style: SecondaryStyle };
};

const DEFAULT_GLOSS = glossGradient(DEFAULT_BRAND_HEX);

export const DEFAULT_APP_COLOUR: AppColourConfig = {
  primary: DEFAULT_BRAND_HEX,
  secondary: "#475569",
  shape: { radius: 8 }, // = --agent-radius-md (never auto-resized by the sweep)
  primaryBtn: {
    // Vertical gloss (lighter top → deeper bottom). The underledge + inner
    // highlight live in the shadow tokens (appColourVars), so this is the one
    // canonical "solid glossy" primary.
    fill: "gradient", gradFrom: DEFAULT_GLOSS.gradFrom, gradTo: DEFAULT_GLOSS.gradTo, angle: 180, text: "auto",
    border: { on: false, style: "solid", width: 1, color: DEFAULT_BRAND_HEX, gradFrom: DEFAULT_GLOSS.gradFrom, gradTo: DEFAULT_GLOSS.gradTo, angle: 180 },
    shadow: 42,
  },
  secondaryBtn: { style: "ghost" },
};

function darkLift(hex: string): string { const b = hexToHsl(hex); return hslToHex({ h: b.h, s: clamp(b.s, 45, 100), l: clamp(b.l, 52, 70) }); }
function autoTextHex(stops: string[]): string { const avg = stops.reduce((s, h) => s + luminance(h), 0) / stops.length; return avg > 0.5 ? "#1a1512" : "#ffffff"; }

// The canonical "solid glossy" gradient derived from one primary hex: a lighter
// top stop + a deeper bottom stop, read as lit-from-above. Paired with the
// underledge + inner highlight in the shadow (see appColourVars) this is the
// one primary-button look across the app.
export function glossGradient(hex: string): { gradFrom: string; gradTo: string } {
  const h = hexToHsl(hex);
  return { gradFrom: shiftL(h, 7), gradTo: shiftL(h, -16) };
}

// Button tokens for a given config + mode, layered onto the accent family.
function appColourVars(cfg: AppColourConfig, dark: boolean): Record<string, string> {
  const vars = deriveBrandVars(cfg.primary, dark); // accent family from the primary
  const L = (hex: string) => (dark ? darkLift(hex) : hex);
  const p = cfg.primaryBtn;

  const from = L(p.gradFrom), to = L(p.gradTo), solid = L(cfg.primary);
  const fillVal = p.fill === "gradient" ? `linear-gradient(${p.angle}deg, ${from}, ${to})` : solid;
  const stops = p.fill === "gradient" ? [from, to] : [solid];
  const text = p.text === "auto" ? autoTextHex(stops) : p.text === "light" ? "#ffffff" : "#1a1512";
  const s = p.shadow;
  // The canonical gloss shadow = underledge (2px solid darker) + ambient drop
  // glow (scaled by the depth slider) + inner top highlight. Rest / hover /
  // active are full composites so customised colours keep the gloss in every
  // state. The ledge + glow derive from the deepest fill stop.
  const deepest = stops[stops.length - 1];
  const ledge = shiftL(hexToHsl(deepest), -8);
  const glowRgb = rgbTriple(deepest);
  const glow = (m: number, am: number) => (s > 0 ? `, 0 ${Math.round(s * 0.1 * m)}px ${Math.round(s * 0.38 * m)}px rgba(${glowRgb}, ${(s * 0.0067 * am).toFixed(2)})` : "");
  const shadowRest = `0 2px 0 ${ledge}${glow(1, 1)}, inset 0 1px 0 rgba(255,255,255,0.32)`;
  const shadowHover = `0 3px 0 ${ledge}${glow(1.45, 1.3)}, inset 0 1px 0 rgba(255,255,255,0.42)`;
  const shadowActive = `0 0 0 ${ledge}${glow(0.7, 0.9)}, inset 0 1px 0 rgba(255,255,255,0.22)`;

  // Border. A gradient border on a rounded button uses the padding-box/border-box
  // double-background technique (border-image ignores border-radius).
  let bg: string, border: string;
  if (p.border.on && p.border.style === "gradient") {
    const gb = `linear-gradient(${p.border.angle}deg, ${L(p.border.gradFrom)}, ${L(p.border.gradTo)})`;
    bg = `${fillVal} padding-box, ${gb} border-box`;
    border = `${p.border.width}px solid transparent`;
  } else if (p.border.on) {
    bg = fillVal;
    border = `${p.border.width}px solid ${L(p.border.color)}`;
  } else {
    bg = fillVal;
    border = `1px solid transparent`;
  }

  vars["--agent-btn-bg"] = bg;
  vars["--agent-btn-text"] = text;
  vars["--agent-btn-border"] = border;
  vars["--agent-btn-radius"] = `${cfg.shape.radius}px`;
  vars["--agent-btn-shadow"] = shadowRest;
  vars["--agent-btn-shadow-hover"] = shadowHover;
  vars["--agent-btn-shadow-active"] = shadowActive;

  // Secondary button — only emit for non-ghost styles; ghost falls back to the
  // existing neutral-glass look via the CSS var() fallbacks.
  const sec = L(cfg.secondary), secRgb = rgbTriple(sec);
  const st = cfg.secondaryBtn.style;
  // Each non-ghost style also sets --agent-btn2-bg-hover so the hover state stays
  // in-family instead of reverting to the neutral glass hover.
  if (st === "soft")    { vars["--agent-btn2-bg"] = `rgba(${secRgb}, 0.14)`; vars["--agent-btn2-bg-hover"] = `rgba(${secRgb}, 0.22)`; vars["--agent-btn2-color"] = sec; vars["--agent-btn2-border"] = "1px solid transparent"; vars["--agent-btn2-shadow"] = "none"; }
  else if (st === "outline") { vars["--agent-btn2-bg"] = "transparent"; vars["--agent-btn2-bg-hover"] = `rgba(${secRgb}, 0.1)`; vars["--agent-btn2-color"] = sec; vars["--agent-btn2-border"] = `1.5px solid ${sec}`; vars["--agent-btn2-shadow"] = "none"; }
  else if (st === "filled")  { vars["--agent-btn2-bg"] = sec; vars["--agent-btn2-bg-hover"] = shiftL(hexToHsl(sec), dark ? 6 : -6); vars["--agent-btn2-color"] = autoTextHex([sec]); vars["--agent-btn2-border"] = "1px solid transparent"; vars["--agent-btn2-shadow"] = "none"; }

  return vars;
}

const BTN_KEYS = ["--agent-btn-bg", "--agent-btn-text", "--agent-btn-border", "--agent-btn-radius", "--agent-btn-shadow", "--agent-btn-shadow-hover", "--agent-btn-shadow-active", "--agent-btn2-bg", "--agent-btn2-bg-hover", "--agent-btn2-color", "--agent-btn2-border", "--agent-btn2-shadow"];
function subsetBody(vars: Record<string, string>, keys: string[]): string { return keys.filter((k) => k in vars).map((k) => `  ${k}: ${vars[k]};`).join("\n"); }

export function appColourCss(cfg: AppColourConfig): string {
  const light = appColourVars(cfg, false);
  const dark = appColourVars(cfg, true);
  const portalKeys = [...CORAL_KEYS, ...BTN_KEYS];
  return [
    `.agent-shell-root[data-theme="custom"], [data-theme="custom"] {`, toCssBody(light), `}`,
    `:root[data-theme="dark"] .agent-shell-root[data-theme="custom"],`,
    `:root[data-theme="dark"] [data-theme="custom"] {`, toCssBody(dark), `}`,
    `.nv2-night, .lum-ov {`, subsetBody(light, portalKeys), `}`,
    `:root[data-theme="dark"] .nv2-night, :root[data-theme="dark"] .lum-ov {`, subsetBody(dark, portalKeys), `}`,
  ].join("\n");
}

// Validate/sanitise the stored JSON into a config (merges defaults; clamps).
export function parseAppColour(raw: unknown): AppColourConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_APP_COLOUR;
  const hex = (v: unknown, fb: string) => (typeof v === "string" ? normaliseHex(v) : null) ?? fb;
  const num = (v: unknown, fb: number, lo: number, hi: number) => clamp(typeof v === "number" ? v : fb, lo, hi);
  const pb = (o.primaryBtn ?? {}) as Record<string, unknown>;
  const bd = (pb.border ?? {}) as Record<string, unknown>;
  const shp = (o.shape ?? {}) as Record<string, unknown>;
  const sb = (o.secondaryBtn ?? {}) as Record<string, unknown>;
  const text = pb.text === "light" || pb.text === "dark" ? pb.text : "auto";
  const secStyle = ["ghost", "soft", "outline", "filled"].includes(sb.style as string) ? (sb.style as SecondaryStyle) : "ghost";
  return {
    primary: hex(o.primary, d.primary),
    secondary: hex(o.secondary, d.secondary),
    shape: { radius: num(shp.radius, d.shape.radius, 0, 40) },
    primaryBtn: {
      fill: pb.fill === "solid" ? "solid" : "gradient",
      gradFrom: hex(pb.gradFrom, d.primaryBtn.gradFrom),
      gradTo: hex(pb.gradTo, d.primaryBtn.gradTo),
      angle: num(pb.angle, 135, 0, 360),
      text,
      border: {
        on: bd.on === true,
        style: bd.style === "gradient" ? "gradient" : "solid",
        width: num(bd.width, 1, 1, 6),
        color: hex(bd.color, d.primaryBtn.border.color),
        gradFrom: hex(bd.gradFrom, d.primaryBtn.border.gradFrom),
        gradTo: hex(bd.gradTo, d.primaryBtn.border.gradTo),
        angle: num(bd.angle, 135, 0, 360),
      },
      shadow: num(pb.shadow, d.primaryBtn.shadow, 0, 100),
    },
    secondaryBtn: { style: secStyle },
  };
}

// Legacy fallback: a user who only has the old single hex gets a config that
// reproduces today's button exactly (gradient accent -> accent+20L, radius 8, the
// matching shadow, no border, auto text).
export function configFromHex(hexInput: string | null | undefined): AppColourConfig {
  const n = normaliseHex(hexInput ?? "") ?? DEFAULT_BRAND_HEX;
  const g = glossGradient(n);
  return {
    ...DEFAULT_APP_COLOUR,
    primary: n,
    primaryBtn: {
      ...DEFAULT_APP_COLOUR.primaryBtn,
      gradFrom: g.gradFrom, gradTo: g.gradTo,
      border: { ...DEFAULT_APP_COLOUR.primaryBtn.border, color: n, gradFrom: g.gradFrom, gradTo: g.gradTo },
    },
  };
}
