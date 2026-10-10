// Email Studio — the expanded design vocabulary on top of the base brand theme.
//
// Pure + dependency-free (safe for the client studio preview AND the server send
// path). The raw storage shape + whitelist live in brand-theme.ts; this module
// holds the font stacks, the curated "looks" catalogue, and resolveStudioTheme()
// which turns a stored EmailThemeInput into render-ready values. Defaults
// reproduce the current coral look, so an untouched theme is unchanged.

import {
  contrastText,
  type EmailThemeInput,
  type TypeSystem,
  type HeaderStyle,
  type ButtonFill,
  type ButtonShape,
  type SizeToken,
  type EmailWidth,
  type Density,
  type SectionStyle,
  type DividerStyle,
  type FooterStyle,
  type HeadingSize,
  type HeadingWeight,
  type Tracking,
  type Leading,
  type Align,
  type CardShadow,
  type BandShape,
  type LogoMode,
} from "@/lib/email/brand-theme";

// ── Type pairings. System-font stacks only (webfonts are unreliable across mail
// clients), chosen to render with distinct character on typical devices. ──
export const FONT_STACKS: Record<TypeSystem, { heading: string; body: string; label: string }> = {
  humanist:  { label: "Humanist",      heading: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" },
  grotesque: { label: "Grotesque",     heading: "'Helvetica Neue',Helvetica,Arial,sans-serif",                   body: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  geometric: { label: "Geometric",     heading: "'Century Gothic','Futura','Avenir Next',sans-serif",            body: "'Century Gothic','Futura','Avenir Next',sans-serif" },
  rounded:   { label: "Rounded",       heading: "ui-rounded,'Hiragino Maru Gothic ProN','Quicksand','Segoe UI',sans-serif", body: "ui-rounded,'Hiragino Maru Gothic ProN','Quicksand','Segoe UI',sans-serif" },
  condensed: { label: "Condensed",     heading: "'Arial Narrow','Roboto Condensed',sans-serif",                  body: "'Helvetica Neue',Arial,sans-serif" },
  classic:   { label: "Classic serif", heading: "Georgia,'Times New Roman',serif",                               body: "Georgia,'Times New Roman',serif" },
  oldstyle:  { label: "Old-style",     heading: "'Iowan Old Style','Palatino Linotype',Palatino,serif",          body: "'Iowan Old Style','Palatino Linotype',Palatino,serif" },
  didone:    { label: "Didone",        heading: "Didot,'Bodoni MT','Playfair Display',Georgia,serif",            body: "Georgia,'Times New Roman',serif" },
  slab:      { label: "Slab",          heading: "Rockwell,'Roboto Slab','Courier New',serif",                    body: "Georgia,serif" },
  editorial: { label: "Editorial",     heading: "Georgia,'Times New Roman',serif",                               body: "-apple-system,'Segoe UI',Roboto,sans-serif" },
  technical: { label: "Monospace",     heading: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",               body: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" },
};

// ── Render-ready theme. Values, not markup, so both the React preview and the
// HTML send path can apply them in their own way. ──
export interface StudioTheme {
  headerStyle: HeaderStyle;
  c1: string; c2: string | null;
  headerBg: string;        // css for the colour header styles (honours angle + stops)
  headerText: string;      // auto-contrast on c1
  accent: string;          // buttons + links
  linkColor: string;
  cardBg: string; pageBg: string;
  headingFont: string; bodyFont: string;
  headingSizePx: number; headingWeight: HeadingWeight; headingWeightNum: number;
  trackingCss: string; leadingCss: string; align: Align;
  buttonFill: ButtonFill; buttonRadiusPx: number; buttonPadCss: string; buttonFontPx: number;
  buttonArrow: boolean; buttonFullWidth: boolean; buttonShadow: boolean;
  contentPadX: number; maxWidthPx: number;
  sectionStyle: SectionStyle; dividerStyle: DividerStyle; footerStyle: FooterStyle;
  cardRadiusPx: number; cardShadow: CardShadow; cardShadowCss: string; cardBorder: boolean;
  showEyebrow: boolean; heroPhoto: boolean;
  // gradient + brand mark + banner
  gradAngle: number; gradStop1: number; gradStop2: number;
  logoMode: LogoMode; bannerScene: number; bannerOverlay: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function hx(v: unknown, fb: string): string { return typeof v === "string" && HEX.test(v) ? v : fb; }
export function tint(hexColor: string, a: number): string {
  const h = hexColor.replace("#", "");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return `rgba(${n(0)},${n(2)},${n(4)},${a})`;
}
export function luminance(hexColor: string): number {
  const h = hexColor.replace("#", "");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const HEADING_PX: Record<HeadingSize, number> = { s: 20, m: 25, l: 31, xl: 38 };
const TRACK: Record<Tracking, string> = { tight: "-0.02em", normal: "0", wide: "0.04em" };
const LEAD: Record<Leading, string> = { tight: "1.42", normal: "1.6", airy: "1.82" };
const PAD_X: Record<Density, number> = { cozy: 18, comfy: 26, roomy: 36 };
const WIDTH_PX: Record<EmailWidth, number> = { narrow: 400, standard: 470, wide: 560 };
const BTN_RADIUS: Record<ButtonShape, number> = { rounded: 9, pill: 999, square: 0 };
const BTN_PAD: Record<SizeToken, string> = { sm: "10px 20px", md: "13px 26px", lg: "16px 34px" };
const BTN_FONT: Record<SizeToken, number> = { sm: 13, md: 15, lg: 16 };
const SHADOW_TOKEN: Record<CardShadow, string> = { none: "none", soft: "0 10px 30px rgba(20,14,8,.14)", strong: "0 22px 60px rgba(20,14,8,.32)" };

// A finite numeric override wins; otherwise the token fallback.
function num(v: unknown, fb: number): number { return typeof v === "number" && Number.isFinite(v) ? v : fb; }
// Slider amount (0–100) → a progressively deeper card shadow (matches the studio).
function shadowFromAmt(a: number): string {
  if (a <= 0) return "none";
  const y = Math.round(8 + a * 0.25), bl = Math.round(18 + a * 0.6), op = (0.1 + a * 0.0025).toFixed(3);
  return `0 ${y}px ${bl}px rgba(20,14,8,${op})`;
}

// Coral defaults = the current look.
const D = {
  typeSystem: "humanist" as TypeSystem, headerStyle: "gradient" as HeaderStyle,
  c1: "#FF8A65", c2: "#FFB74D", accent: "#FF6B4A", cardBg: "#ffffff", pageBg: "#f4f4f6",
  headingSize: "l" as HeadingSize, headingWeight: "800" as HeadingWeight, tracking: "normal" as Tracking,
  leading: "normal" as Leading, align: "left" as Align, buttonFill: "filled" as ButtonFill,
  buttonShape: "rounded" as ButtonShape, buttonSize: "md" as SizeToken, width: "standard" as EmailWidth,
  density: "comfy" as Density, sectionStyle: "plain" as SectionStyle, dividerStyle: "none" as DividerStyle,
  footerStyle: "band" as FooterStyle, bandShape: "rounded" as BandShape, cardShadow: "soft" as CardShadow,
};

export function resolveStudioTheme(input: EmailThemeInput | null | undefined): StudioTheme {
  const t = (input && typeof input === "object" ? input : {}) as EmailThemeInput;
  const headerStyle = (t.headerStyle ?? D.headerStyle) as HeaderStyle;
  const c1 = hx(t.headerColor, D.c1);
  // A gradient-capable style keeps a second stop; others go flat.
  const gradientCapable = headerStyle === "gradient" || headerStyle === "duotone";
  const c2 = gradientCapable ? (t.headerColor2 && HEX.test(t.headerColor2) ? t.headerColor2 : (t.headerColor ? null : D.c2)) : null;
  const gradAngle = num(t.gradAngle, 135), gradStop1 = num(t.gradStop1, 0), gradStop2 = num(t.gradStop2, 100);
  const headerBg = c2 ? `linear-gradient(${gradAngle}deg,${c1} ${gradStop1}%,${c2} ${gradStop2}%)` : c1;
  const accent = hx(t.accentColor, hx(t.buttonColor, D.accent));
  const cardBg = hx(t.cardBg, D.cardBg);
  const typeSystem = (t.typeSystem ?? D.typeSystem) as TypeSystem;
  const buttonSize = (t.buttonSize ?? D.buttonSize) as SizeToken;
  const buttonShape = (t.buttonShape ?? D.buttonShape) as ButtonShape;
  const bandShape = (t.bandShape ?? D.bandShape) as BandShape;
  const headingWeight = (t.headingWeight ?? D.headingWeight) as HeadingWeight;
  const cardShadow = (t.cardShadow ?? D.cardShadow) as CardShadow;
  // Button padding: numeric Y/X wins (either present), else the size token.
  const buttonPadCss = (t.buttonPadY != null || t.buttonPadX != null)
    ? `${num(t.buttonPadY, 13)}px ${num(t.buttonPadX, 26)}px`
    : BTN_PAD[buttonSize];
  return {
    headerStyle, c1, c2, headerBg,
    headerText: hx(t.headerTextColor, contrastText(c1)),
    accent, linkColor: hx(t.linkColor, accent),
    cardBg, pageBg: hx(t.pageBg, D.pageBg),
    headingFont: FONT_STACKS[typeSystem].heading, bodyFont: FONT_STACKS[typeSystem].body,
    headingSizePx: num(t.headlinePx, HEADING_PX[(t.headingSize ?? D.headingSize) as HeadingSize]),
    headingWeight, headingWeightNum: num(t.headingWeightNum, Number(headingWeight)),
    trackingCss: t.trackingEm != null ? `${t.trackingEm}em` : TRACK[(t.tracking ?? D.tracking) as Tracking],
    leadingCss: t.lineHeight != null ? String(t.lineHeight) : LEAD[(t.leading ?? D.leading) as Leading],
    align: (t.align ?? D.align) as Align,
    buttonFill: (t.buttonFill ?? D.buttonFill) as ButtonFill,
    buttonRadiusPx: num(t.buttonRadiusPx, BTN_RADIUS[buttonShape]), buttonPadCss, buttonFontPx: num(t.buttonFontPx, BTN_FONT[buttonSize]),
    buttonArrow: t.buttonArrow ?? true, buttonFullWidth: t.buttonFullWidth ?? false, buttonShadow: t.buttonShadow ?? false,
    contentPadX: num(t.padX, PAD_X[(t.density ?? D.density) as Density]), maxWidthPx: num(t.widthPx, WIDTH_PX[(t.width ?? D.width) as EmailWidth]),
    sectionStyle: (t.sectionStyle ?? D.sectionStyle) as SectionStyle,
    dividerStyle: (t.dividerStyle ?? D.dividerStyle) as DividerStyle,
    footerStyle: (t.footerStyle ?? D.footerStyle) as FooterStyle,
    cardRadiusPx: num(t.cardRadiusPx, bandShape === "square" ? 0 : 16),
    cardShadow, cardShadowCss: t.shadowAmt != null ? shadowFromAmt(t.shadowAmt) : SHADOW_TOKEN[cardShadow],
    cardBorder: t.cardBorder ?? false, showEyebrow: t.showEyebrow ?? true, heroPhoto: t.heroPhoto ?? false,
    gradAngle, gradStop1, gradStop2,
    logoMode: (t.logoMode ?? "monogram") as LogoMode, bannerScene: num(t.bannerScene, 0), bannerOverlay: num(t.bannerOverlay, 45),
  };
}

// ── The curated "looks": one-click starting points, grouped into style families.
// Each is a partial theme merged over the coral defaults. ──
export type LookCategory = "bold" | "elegant" | "minimal" | "warm" | "dark" | "classic";
export interface EmailLook { key: string; label: string; tag: string; cat: LookCategory; theme: EmailThemeInput; }

export const LOOK_CATEGORIES: Array<{ key: LookCategory | "all"; label: string }> = [
  { key: "all", label: "All" }, { key: "bold", label: "Bold & colourful" }, { key: "elegant", label: "Elegant" },
  { key: "minimal", label: "Minimal" }, { key: "warm", label: "Warm" }, { key: "dark", label: "Dark & premium" }, { key: "classic", label: "Classic" },
];

function look(key: string, label: string, tag: string, cat: LookCategory, theme: EmailThemeInput): EmailLook {
  return { key, label, tag, cat, theme };
}

export const LOOKS: EmailLook[] = [
  look("coral", "Coral", "the current look", "bold", { headerStyle: "gradient", headerColor: "#FF8A65", headerColor2: "#FFB74D", accentColor: "#FF6B4A", typeSystem: "humanist", headingSize: "l", headingWeight: "800", buttonShape: "rounded", footerStyle: "band" }),
  look("electric", "Electric", "blunt blue", "bold", { headerStyle: "solid", headerColor: "#2563EB", accentColor: "#2563EB", pageBg: "#E6ECF8", typeSystem: "grotesque", headingSize: "xl", headingWeight: "900", buttonShape: "square", bandShape: "square", footerStyle: "band" }),
  look("sunset", "Sunset", "warm gradient", "bold", { headerStyle: "gradient", headerColor: "#FB7185", headerColor2: "#FDBA74", accentColor: "#F97316", pageBg: "#FBEEE6", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonShape: "pill", footerStyle: "band" }),
  look("crimson", "Crimson", "confident red", "bold", { headerStyle: "solid", headerColor: "#E11D48", accentColor: "#E11D48", pageBg: "#F7E6EA", typeSystem: "grotesque", headingSize: "xl", headingWeight: "900", buttonShape: "rounded", footerStyle: "band" }),
  look("grape", "Grape", "playful pop", "bold", { headerStyle: "gradient", headerColor: "#7C3AED", headerColor2: "#DB2777", accentColor: "#7C3AED", pageBg: "#F1E9FB", typeSystem: "rounded", headingSize: "xl", headingWeight: "900", buttonShape: "pill", sectionStyle: "cards", footerStyle: "band" }),

  look("elegant", "Elegant", "serif & air", "elegant", { headerStyle: "minimal", headerColor: "#2B2622", accentColor: "#9A7B4F", pageBg: "#F1ECE4", typeSystem: "didone", headingSize: "xl", headingWeight: "400", buttonFill: "outline", buttonShape: "pill", footerStyle: "none", dividerStyle: "hairline", align: "center", tracking: "wide" }),
  look("editorial", "Editorial", "magazine", "elegant", { headerStyle: "banner", headerColor: "#1A1614", accentColor: "#B4532B", pageBg: "#EDE9E2", typeSystem: "editorial", headingSize: "xl", headingWeight: "400", buttonFill: "outline", buttonShape: "square", density: "roomy", footerStyle: "simple", dividerStyle: "hairline" }),
  look("luxe", "Luxe", "black & gold", "elegant", { headerStyle: "duotone", headerColor: "#111111", headerColor2: "#1C1C1C", accentColor: "#C8A04A", cardBg: "#14110D", pageBg: "#060504", typeSystem: "didone", headingSize: "l", headingWeight: "400", buttonFill: "outline", buttonShape: "square", footerStyle: "simple", align: "center", tracking: "wide", cardShadow: "strong" }),
  look("ivory", "Ivory", "soft & refined", "elegant", { headerStyle: "minimal", headerColor: "#3A332B", accentColor: "#8A6A3B", cardBg: "#FFFDF8", pageBg: "#F2EDE3", typeSystem: "classic", headingSize: "l", headingWeight: "400", buttonFill: "outline", buttonShape: "pill", footerStyle: "simple", align: "center" }),

  look("minimal", "Minimal", "quiet & clean", "minimal", { headerStyle: "minimal", headerColor: "#111111", accentColor: "#111111", pageBg: "#EDEDED", typeSystem: "grotesque", headingSize: "m", headingWeight: "600", buttonFill: "outline", buttonShape: "square", bandShape: "square", footerStyle: "none", cardShadow: "none", width: "narrow", density: "cozy" }),
  look("mono", "Mono", "technical", "minimal", { headerStyle: "minimal", headerColor: "#111111", accentColor: "#111111", pageBg: "#ECECEC", typeSystem: "technical", headingSize: "m", headingWeight: "600", buttonFill: "outline", buttonShape: "square", bandShape: "square", footerStyle: "none", cardShadow: "none", density: "cozy" }),
  look("swiss", "Swiss", "grid & pop", "minimal", { headerStyle: "solid", headerColor: "#111111", accentColor: "#E11D48", pageBg: "#E9E9E9", typeSystem: "grotesque", headingSize: "l", headingWeight: "900", buttonShape: "square", bandShape: "square", footerStyle: "simple" }),
  look("paper", "Paper", "calm & plain", "minimal", { headerStyle: "none", headerColor: "#333333", accentColor: "#1A7F5A", cardBg: "#FFFEFB", pageBg: "#EFEDE7", typeSystem: "humanist", headingSize: "m", headingWeight: "600", buttonFill: "soft", buttonShape: "rounded", footerStyle: "simple", cardShadow: "none" }),

  look("boutique", "Boutique", "warm & soft", "warm", { headerStyle: "solid", headerColor: "#D1668A", accentColor: "#D1668A", cardBg: "#FFFCFB", pageBg: "#F3E8E6", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonFill: "soft", buttonShape: "pill", density: "roomy", sectionStyle: "cards", footerStyle: "band" }),
  look("blush", "Blush", "pastel gradient", "warm", { headerStyle: "gradient", headerColor: "#F6D9D0", headerColor2: "#EFC7D6", accentColor: "#D1668A", cardBg: "#FFFCFB", pageBg: "#F3E8E6", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonShape: "pill", footerStyle: "band" }),
  look("terracotta", "Terracotta", "earthy", "warm", { headerStyle: "logoband", headerColor: "#B4532B", accentColor: "#B4532B", cardBg: "#FFFBF6", pageBg: "#EFE6DD", typeSystem: "oldstyle", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple" }),
  look("honey", "Honey", "golden warm", "warm", { headerStyle: "gradient", headerColor: "#F6B73C", headerColor2: "#F59E0B", accentColor: "#D97706", pageBg: "#F7EEDD", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonShape: "pill", footerStyle: "band" }),

  look("midnight", "Midnight", "dark gradient", "dark", { headerStyle: "gradient", headerColor: "#1E293B", headerColor2: "#0EA5A4", accentColor: "#38BDF8", cardBg: "#0F172A", pageBg: "#05080F", typeSystem: "grotesque", headingSize: "l", headingWeight: "800", buttonShape: "pill", footerStyle: "simple", cardShadow: "strong" }),
  look("noir", "Noir", "black tie", "dark", { headerStyle: "duotone", headerColor: "#0A0A0A", headerColor2: "#1A1A1A", accentColor: "#C8A04A", cardBg: "#0D0D0D", pageBg: "#000000", typeSystem: "didone", headingSize: "l", headingWeight: "400", buttonFill: "outline", buttonShape: "square", footerStyle: "simple", align: "center", tracking: "wide", cardShadow: "strong" }),
  look("onyx", "Onyx", "indigo dark", "dark", { headerStyle: "solid", headerColor: "#111827", accentColor: "#818CF8", cardBg: "#111827", pageBg: "#05070D", typeSystem: "grotesque", headingSize: "l", headingWeight: "800", buttonShape: "rounded", footerStyle: "simple", cardShadow: "strong" }),
  look("slate", "Slate", "dark & minimal", "dark", { headerStyle: "minimal", headerColor: "#E2E8F0", accentColor: "#38BDF8", cardBg: "#1E293B", pageBg: "#0B1220", typeSystem: "humanist", headingSize: "m", headingWeight: "600", buttonFill: "outline", buttonShape: "pill", footerStyle: "none", cardShadow: "strong" }),

  look("navygold", "Navy & Gold", "trusted", "classic", { headerStyle: "solid", headerColor: "#0F2A5A", accentColor: "#C8A04A", pageBg: "#ECEEF2", typeSystem: "oldstyle", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "band" }),
  look("heritage", "Heritage", "estate green", "classic", { headerStyle: "logoband", headerColor: "#14532D", accentColor: "#14532D", cardBg: "#FFFDF8", pageBg: "#ECEADF", typeSystem: "slab", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple" }),
  look("oxford", "Oxford", "navy serif", "classic", { headerStyle: "solid", headerColor: "#1E293B", accentColor: "#1E293B", pageBg: "#EAECF0", typeSystem: "classic", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple", align: "center" }),
  look("burgundy", "Burgundy", "wine & cream", "classic", { headerStyle: "solid", headerColor: "#6B1E2E", accentColor: "#6B1E2E", cardBg: "#FFFDFA", pageBg: "#EFE7E3", typeSystem: "oldstyle", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "band" }),

  look("tangerine", "Tangerine", "zesty solid", "bold", { headerStyle: "solid", headerColor: "#F97316", accentColor: "#F97316", pageBg: "#FBEEE2", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonShape: "pill", footerStyle: "band" }),
  look("cobalt", "Cobalt", "deep duotone", "bold", { headerStyle: "duotone", headerColor: "#1E3A8A", headerColor2: "#1E3A8A", accentColor: "#3B82F6", pageBg: "#E8EDF8", typeSystem: "grotesque", headingSize: "xl", headingWeight: "900", buttonShape: "rounded", footerStyle: "band" }),
  look("coastal", "Coastal", "photo banner", "bold", { headerStyle: "banner", headerColor: "#2B4A6B", accentColor: "#0EA5A4", pageBg: "#E7EEF2", typeSystem: "humanist", headingSize: "xl", headingWeight: "800", buttonShape: "pill", footerStyle: "simple" }),

  look("champagne", "Champagne", "cream & calm", "elegant", { headerStyle: "minimal", headerColor: "#8A7A5B", accentColor: "#8A7A5B", cardBg: "#FFFEFA", pageBg: "#F3EEE2", typeSystem: "didone", headingSize: "xl", headingWeight: "400", buttonFill: "outline", buttonShape: "pill", footerStyle: "simple", align: "center", tracking: "wide" }),
  look("monochrome", "Monochrome", "ink editorial", "elegant", { headerStyle: "minimal", headerColor: "#1A1A1A", accentColor: "#1A1A1A", pageBg: "#ECECEC", typeSystem: "editorial", headingSize: "xl", headingWeight: "400", buttonFill: "outline", buttonShape: "square", footerStyle: "simple", dividerStyle: "hairline" }),

  look("linen", "Linen", "warm minimal", "minimal", { headerStyle: "minimal", headerColor: "#6B5D4F", accentColor: "#8A6A3B", cardBg: "#FDFBF6", pageBg: "#EFEADF", typeSystem: "oldstyle", headingSize: "m", headingWeight: "600", buttonFill: "soft", buttonShape: "rounded", footerStyle: "simple", cardShadow: "none" }),
  look("ink", "Ink", "stark black", "minimal", { headerStyle: "solid", headerColor: "#000000", accentColor: "#000000", pageBg: "#E6E6E6", typeSystem: "grotesque", headingSize: "xl", headingWeight: "900", buttonShape: "square", bandShape: "square", footerStyle: "none" }),

  look("peach", "Peach", "soft sunrise", "warm", { headerStyle: "gradient", headerColor: "#FCA5A5", headerColor2: "#FDE68A", accentColor: "#F97316", cardBg: "#FFFCFA", pageBg: "#FBEFE8", typeSystem: "rounded", headingSize: "l", headingWeight: "800", buttonFill: "soft", buttonShape: "pill", footerStyle: "band" }),
  look("sage", "Sage", "calm green", "warm", { headerStyle: "logoband", headerColor: "#5F7A5A", accentColor: "#5F7A5A", cardBg: "#FBFDF9", pageBg: "#ECF0E7", typeSystem: "humanist", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple" }),

  look("forestnight", "Forest Night", "dark green", "dark", { headerStyle: "solid", headerColor: "#14321F", accentColor: "#6EE7B7", cardBg: "#0E241A", pageBg: "#05100A", typeSystem: "slab", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple", cardShadow: "strong" }),
  look("plum", "Plum", "dark & rich", "dark", { headerStyle: "gradient", headerColor: "#3B0764", headerColor2: "#7C3AED", accentColor: "#C4B5FD", cardBg: "#1A0B2E", pageBg: "#0A0416", typeSystem: "didone", headingSize: "l", headingWeight: "400", buttonFill: "outline", buttonShape: "pill", footerStyle: "simple", align: "center", cardShadow: "strong" }),

  look("racinggreen", "Racing Green", "heritage", "classic", { headerStyle: "solid", headerColor: "#14432A", accentColor: "#C8A04A", pageBg: "#EAEFEA", typeSystem: "classic", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "band", align: "center" }),
  look("oxblood", "Oxblood", "deep & bold", "classic", { headerStyle: "logoband", headerColor: "#5A161E", accentColor: "#5A161E", cardBg: "#FFFDFB", pageBg: "#EEE5E2", typeSystem: "oldstyle", headingSize: "l", headingWeight: "600", buttonShape: "rounded", footerStyle: "simple" }),
];

export const LOOKS_BY_KEY: Record<string, EmailLook> = Object.fromEntries(LOOKS.map((l) => [l.key, l]));
