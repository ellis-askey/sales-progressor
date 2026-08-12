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

    // Focus + hover, all from the accent
    "--agent-border-focus": `rgba(${rgb}, 0.45)`,
    "--agent-focus-ring": `0 0 0 1.5px rgba(${rgb}, 0.50), 0 0 12px 2px rgba(${rgb}, 0.18)`,
    "--agent-focus-ring-tight": `0 0 0 1px rgba(${rgb}, 0.60), 0 0 8px 1px rgba(${rgb}, 0.22)`,
    "--agent-hover-tint": `rgba(${rgb}, 0.10)`,
    "--agent-hover-tint-strong": `rgba(${rgb}, 0.18)`,

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
  ].join("\n");
}
