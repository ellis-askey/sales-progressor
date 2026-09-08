// Single source of truth for the CLIENT-EMAIL brand theme: the hero band under
// the logo, the CTA button, links and footer. Pure + dependency-free, so it's
// safe to import from the email send paths (server) AND the branding-studio live
// preview (client). Defaults reproduce the Sales Progressor coral exactly, so an
// agency that hasn't customised looks identical to before.
//
// Applies to CLIENT-facing emails only. Platform emails (password reset, team
// invites, chain notifications, etc.) stay Sales-Progressor-branded and don't use
// this. See docs — the studio is Account > Profile > "Email branding".

const HEX = /^#[0-9a-fA-F]{6}$/;

// The current hand-rolled coral, kept as the defaults so nothing changes until an
// agency picks their own colours.
const DEFAULT_HEADER = "#FF8A65";
const DEFAULT_HEADER_2 = "#FFB74D";
const DEFAULT_BUTTON = "#FF6B4A";

export type GradientDir = "horizontal" | "diagonal" | "vertical";
export type BandShape = "rounded" | "square";

// The raw stored blob (Agency.emailTheme). Every key optional.
export interface EmailThemeInput {
  headerColor?: string | null;
  headerColor2?: string | null; // set → gradient end stop; null → flat header
  gradientDir?: GradientDir | null;
  buttonColor?: string | null;
  headerTextColor?: string | null; // manual override; null → auto-contrast
  linkColor?: string | null;
  footerBg?: string | null;
  footerText?: string | null;
  bandShape?: BandShape | null;
}

// Resolved, render-ready values.
export interface EmailTheme {
  headerBg: string; // flat hex OR "linear-gradient(...)"
  headerText: string; // auto-contrast (or the manual override)
  buttonBg: string;
  buttonText: string; // auto-contrast on the button
  linkColor: string;
  footerBg: string | null;
  footerText: string;
  bandRadius: string; // "0 0 24px 24px" (rounded) or "0" (square)
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

const GRAD_DIRS = new Set<GradientDir>(["horizontal", "diagonal", "vertical"]);
const BAND_SHAPES = new Set<BandShape>(["rounded", "square"]);
function hexOrNull(v: unknown): string | null {
  return typeof v === "string" && HEX.test(v) ? v : null;
}

// Whitelist + validate an untrusted theme blob (from the branding studio) into a
// clean EmailThemeInput before it's stored. Drops anything invalid; returns null
// when nothing usable is left, so an all-default theme stores as null (= coral).
export function sanitizeEmailThemeInput(raw: unknown): EmailThemeInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: EmailThemeInput = {};
  const headerColor = hexOrNull(r.headerColor);
  if (headerColor) out.headerColor = headerColor;
  const headerColor2 = hexOrNull(r.headerColor2);
  if (headerColor2) out.headerColor2 = headerColor2;
  if (typeof r.gradientDir === "string" && GRAD_DIRS.has(r.gradientDir as GradientDir)) out.gradientDir = r.gradientDir as GradientDir;
  const buttonColor = hexOrNull(r.buttonColor);
  if (buttonColor) out.buttonColor = buttonColor;
  const headerTextColor = hexOrNull(r.headerTextColor);
  if (headerTextColor) out.headerTextColor = headerTextColor;
  const linkColor = hexOrNull(r.linkColor);
  if (linkColor) out.linkColor = linkColor;
  const footerBg = hexOrNull(r.footerBg);
  if (footerBg) out.footerBg = footerBg;
  const footerText = hexOrNull(r.footerText);
  if (footerText) out.footerText = footerText;
  if (typeof r.bandShape === "string" && BAND_SHAPES.has(r.bandShape as BandShape)) out.bandShape = r.bandShape as BandShape;
  return Object.keys(out).length ? out : null;
}

// Relative luminance → black or white text for legible contrast (WCAG-style).
export function contrastText(bg: string): string {
  const h = bg.replace("#", "");
  const chan = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  return L > 0.5 ? "#1a1d29" : "#ffffff";
}

const GRAD_ANGLE: Record<GradientDir, string> = {
  horizontal: "90deg",
  diagonal: "135deg",
  vertical: "180deg",
};

export function resolveEmailTheme(input: EmailThemeInput | null | undefined): EmailTheme {
  const t = (input && typeof input === "object" ? input : {}) as EmailThemeInput;
  const customHeader = typeof t.headerColor === "string" && HEX.test(t.headerColor);
  const c1 = customHeader ? (t.headerColor as string) : DEFAULT_HEADER;
  // Uncustomised → keep the coral gradient. Customised → gradient only if a valid
  // second stop is set, otherwise flat.
  const c2 = customHeader
    ? (typeof t.headerColor2 === "string" && HEX.test(t.headerColor2) ? t.headerColor2 : null)
    : DEFAULT_HEADER_2;
  const dir: GradientDir = t.gradientDir && GRAD_ANGLE[t.gradientDir] ? t.gradientDir : "diagonal";
  const headerBg = c2 ? `linear-gradient(${GRAD_ANGLE[dir]},${c1} 0%,${c2} 100%)` : c1;
  const headerText = hex(t.headerTextColor, contrastText(c1));
  const buttonBg = hex(t.buttonColor, DEFAULT_BUTTON);
  const buttonText = contrastText(buttonBg);
  const linkColor = hex(t.linkColor, buttonBg);
  const footerBg = typeof t.footerBg === "string" && HEX.test(t.footerBg) ? t.footerBg : null;
  const footerText = hex(t.footerText, footerBg ? contrastText(footerBg) : "#8b91a3");
  const bandRadius = t.bandShape === "square" ? "0" : "0 0 24px 24px";
  return { headerBg, headerText, buttonBg, buttonText, linkColor, footerBg, footerText, bandRadius };
}

// Pick a header-relative colour: the white-on-dark value when the header text is
// white, the black-on-light value otherwise. Exported so the hand-rolled milestone
// renderers can tone their own eyebrow/subline the same way as emailHeroBand.
export function tone(headerText: string, white: string, dark: string): string {
  return headerText === "#ffffff" ? white : dark;
}

// The hero band under the logo: eyebrow (agency name), headline (address),
// subline (milestone/message). Markup matches the existing hand-rolled hero so a
// default theme is visually identical to before.
export function emailHeroBand(opts: {
  theme: EmailTheme;
  eyebrow?: string | null;
  headline: string;
  subline?: string | null;
}): string {
  const { theme } = opts;
  const eyebrowColor = tone(theme.headerText, "rgba(255,255,255,0.75)", "rgba(0,0,0,0.55)");
  const sublineColor = tone(theme.headerText, "rgba(255,255,255,0.9)", "rgba(0,0,0,0.7)");
  return (
    `<div style="background:${theme.headerBg};padding:40px 32px 32px;border-radius:${theme.bandRadius}">` +
    (opts.eyebrow
      ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor}">${opts.eyebrow}</p>`
      : "") +
    `<h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${theme.headerText};line-height:1.2">${opts.headline}</h1>` +
    (opts.subline ? `<p style="margin:0;font-size:14px;color:${sublineColor}">${opts.subline}</p>` : "") +
    `</div>`
  );
}

// The primary CTA button, auto-contrasted on the brand colour.
export function emailButton(opts: { theme: EmailTheme; href: string; label: string }): string {
  const { theme } = opts;
  return (
    `<a href="${opts.href}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};` +
    `padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${opts.label}</a>`
  );
}
