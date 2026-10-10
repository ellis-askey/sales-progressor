// Studio email renderer — the SERVER-side twin of the EmailStudio live preview.
//
// Turns a resolved StudioTheme + content slots into the full client-email HTML,
// honouring the whole design vocabulary the studio exposes: header style, type
// (heading + body font, size, weight, tracking, leading), alignment, colours
// (incl. accent for button + links), layout (width, padding, sections, dividers),
// button (fill, shape, size, arrow, full-width, shadow), card (radius, shadow,
// border) and footer. Content (greeting, body blocks, CTA, trailing block) is
// passed in so each caller keeps its own copy while the shell is themed uniformly.
//
// Mirrors components/account/v2/EmailStudio.tsx so "preview == what's received".
// System-font stacks only (webfonts are unreliable in mail clients). Divs + inline
// styles to match the existing hand-rolled client emails (already in production).

import { resolveStudioTheme, tint, luminance, type StudioTheme } from "@/lib/email/email-theme-studio";
import type { EmailThemeInput, LogoMode } from "@/lib/email/brand-theme";

const SCENES = [
  "linear-gradient(120deg,#2b4a6b,#8aa0b5 60%,#c9b79c)",
  "linear-gradient(120deg,#3a5a40,#7a9b6e 55%,#c8d6a8)",
  "linear-gradient(120deg,#4a4e69,#9a8c98 55%,#c9ada7)",
  "linear-gradient(120deg,#6b4423,#b08968 55%,#e6ccb2)",
];

function contrast(hexColor: string): string { return luminance(hexColor) > 0.52 ? "#1a1a1a" : "#ffffff"; }
function bodyInk(cardBg: string) {
  const dark = luminance(cardBg) < 0.4;
  return dark
    ? { main: "#F3F0EB", soft: "rgba(243,240,235,.82)", mut: "rgba(243,240,235,.55)", rule: "rgba(255,255,255,.13)" }
    : { main: "#1a1a1a", soft: "#33302b", mut: "#9a948a", rule: "rgba(20,16,10,.1)" };
}
function dividerCss(st: StudioTheme, rule: string): string {
  if (st.dividerStyle === "none") return "";
  if (st.dividerStyle === "hairline") return `1px solid ${rule}`;
  if (st.dividerStyle === "thick") return `2px solid ${st.accent}`;
  return `1px dashed ${rule}`;
}
function bannerBg(st: StudioTheme): string {
  const ov = (st.bannerOverlay || 0) / 100;
  return `linear-gradient(rgba(0,0,0,${ov}),rgba(0,0,0,${ov})),${SCENES[st.bannerScene] || SCENES[0]}`;
}
function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x));
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "A";
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Logo-aware default: an uploaded logo shows by default (today's behaviour), but
// an explicit wordmark/monogram choice wins. No logo -> monogram.
export function effectiveLogoMode(raw: EmailThemeInput | null | undefined, hasLogo: boolean): LogoMode {
  return raw?.logoMode ?? (hasLogo ? "logo" : "monogram");
}

// Brand mark: uploaded logo on a tile / wordmark / refined monogram. sz = nominal
// size; bg = monogram disc bg; fg = text / contrast colour.
function brandMarkHtml(st: StudioTheme, sz: number, bg: string, fg: string, identityName: string, logoUrl: string | null, tileColor: string): string {
  if (st.logoMode === "logo" && logoUrl) {
    const pad = `${Math.round(sz * 0.16)}px ${Math.round(sz * 0.34)}px`;
    const radius = st.cardRadiusPx === 0 ? "0" : "9px";
    return `<span style="display:inline-block;background:${tileColor};padding:${pad};border-radius:${radius}"><img src="${esc(logoUrl)}" alt="" height="${Math.round(sz * 0.62)}" style="height:${Math.round(sz * 0.62)}px;max-width:170px;display:block;border:0"></span>`;
  }
  if (st.logoMode === "wordmark" || (st.logoMode === "logo" && !logoUrl)) {
    return `<span style="font-family:${st.headingFont};font-weight:800;font-size:${Math.round(sz * 0.46)}px;letter-spacing:-0.01em;color:${fg}">${esc(identityName)}</span>`;
  }
  const ring = fg === "#ffffff" || fg === "#fff" ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.14)";
  return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;text-align:center;line-height:${sz}px;font-weight:800;font-size:${Math.round(sz * 0.38)}px;background:${bg};color:${fg};box-shadow:inset 0 0 0 1.5px ${ring};font-family:${st.headingFont}">${esc(initials(identityName))}</div>`;
}

export interface StudioEmailContent {
  eyebrow?: string | null;   // header eyebrow (e.g. the property address)
  headline: string;          // header headline (trusted HTML/text)
  lead?: string | null;      // subline under the headline (solid/gradient/banner headers)
  greeting?: string | null;  // "Hi Daniel,"
  blocks?: Array<{ label?: string | null; html: string }>; // body paragraphs (trusted, pre-interpolated); omit when using bodyHtml
  // Escape hatch for emails with bespoke body markup (bullet lists, tone
  // branching, compliance footers) — when set it REPLACES `blocks` in the themed
  // body container (which still applies the body font + colour + padding), so the
  // shell is themed while the body keeps its own structure. Greeting still renders.
  bodyHtml?: string;
  cta?: { label: string; url: string } | null;
  trailingHtml?: string | null; // signature/contact block (trusted; inherits body font)
  footerText?: string | null;   // overrides the default footer sign-off line
  preheaderText?: string | null;
}

export interface StudioRenderOpts {
  identityName: string;
  logoUrl?: string | null;
  tileColor?: string | null;
}

function header(st: StudioTheme, c: StudioEmailContent, T: ReturnType<typeof bodyInk>, mark: (sz: number, bg: string, fg: string) => string, identityName: string): string {
  const px = st.contentPadX;
  const track = st.trackingCss === "0" || st.trackingCss === "0em" ? "0.12em" : st.trackingCss;
  const eyebrow = (col: string) => st.showEyebrow && c.eyebrow ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:${track};text-transform:uppercase;color:${col}">${c.eyebrow}</p>` : "";
  const hl = (col: string) => `<h1 style="margin:0;font-family:${st.headingFont};font-size:${st.headingSizePx}px;font-weight:${st.headingWeightNum};letter-spacing:${st.trackingCss};color:${col};line-height:1.16">${c.headline}</h1>`;

  if (st.headerStyle === "none") return `<div style="padding:${px}px ${px}px 0;text-align:${st.align}">${mark(40, tint(st.accent, 0.12), st.accent)}</div>`;
  if (st.headerStyle === "minimal") return `<div style="padding:${px}px ${px}px 20px;border-bottom:3px solid ${st.accent};text-align:${st.align}"><div style="margin-bottom:14px">${mark(40, tint(st.accent, 0.14), st.accent)}</div>${eyebrow(st.accent)}${hl(T.main)}</div>`;
  if (st.headerStyle === "logoband") {
    const bandBg = luminance(st.cardBg) < 0.4 ? tint(st.accent, 0.16) : (luminance(st.c1) > 0.6 ? tint(st.c1, 0.2) : "#ffffff");
    const nameTag = st.logoMode !== "wordmark" ? `<span style="font-family:${st.headingFont};font-weight:800;font-size:15px;color:${T.main};vertical-align:middle;margin-left:10px">${esc(identityName)}</span>` : "";
    return `<div style="background:${bandBg};padding:13px ${px}px;border-bottom:3px solid ${st.accent}"><span style="vertical-align:middle">${mark(28, st.headerBg, contrast(st.c1))}</span>${nameTag}</div><div style="padding:20px ${px}px 0;text-align:${st.align}">${eyebrow(st.accent)}${hl(T.main)}</div>`;
  }
  if (st.headerStyle === "banner") return `<div style="background:${bannerBg(st)};padding:${px + 16}px ${px}px;text-align:${st.align}"><div style="margin-bottom:12px">${mark(40, tint("#ffffff", 0.2), "#fff")}</div>${eyebrow("#fff")}<h1 style="margin:0;font-family:${st.headingFont};font-size:${st.headingSizePx}px;font-weight:${st.headingWeightNum};letter-spacing:${st.trackingCss};color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.4);line-height:1.16">${c.headline}</h1>${c.lead ? `<p style="margin:9px 0 0;font-size:14px;color:#fff">${c.lead}</p>` : ""}</div>`;
  const tx = contrast(st.c1);
  const cen = st.headerStyle === "centered" ? "center" : st.align;
  const bg = st.headerStyle === "duotone" ? `linear-gradient(${st.gradAngle}deg,${st.c1} 0%,${st.c1} 55%,${st.accent} 100%)` : st.headerBg;
  return `<div style="background:${bg};padding:${px + 2}px ${px}px;text-align:${cen}"><div style="margin-bottom:14px">${mark(40, tint(tx === "#ffffff" ? "#ffffff" : "#000000", 0.16), tx)}</div>${eyebrow(tx)}${hl(tx)}${c.lead ? `<p style="margin:9px 0 0;font-size:14px;color:${tx};opacity:.92">${c.lead}</p>` : ""}</div>`;
}

export function renderStudioEmail(st: StudioTheme, content: StudioEmailContent, opts: StudioRenderOpts): string {
  const T = bodyInk(st.cardBg);
  const px = st.contentPadX;
  const logoUrl = opts.logoUrl ?? null;
  const tileColor = opts.tileColor ?? "#ffffff";
  const mark = (sz: number, bg: string, fg: string) => brandMarkHtml(st, sz, bg, fg, opts.identityName, logoUrl, tileColor);

  const greeting = content.greeting ? `<p style="margin:0 0 15px;font-size:14.5px;line-height:${st.leadingCss};color:${T.main};font-family:${st.bodyFont}">${content.greeting}</p>` : "";
  const blocks = (content.blocks ?? []).map((b, i) => {
    const card = st.sectionStyle === "cards";
    const labelHtml = b.label ? `<span style="display:block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;color:${card ? st.accent : T.mut}">${b.label}</span>` : "";
    if (card) return `<div style="border:1px solid ${T.rule};border-radius:${st.cardRadiusPx === 0 ? "0" : "10px"};padding:14px 16px;margin-bottom:12px">${labelHtml}<span style="font-size:14.5px;line-height:${st.leadingCss};color:${T.soft};font-family:${st.bodyFont}">${b.html}</span></div>`;
    const sep = i === 0 ? "" : (dividerCss(st, T.rule) ? `padding-top:14px;margin-top:2px;border-top:${dividerCss(st, T.rule)};` : "");
    return `<div style="margin-bottom:14px;${sep}">${labelHtml}<span style="font-size:14.5px;line-height:${st.leadingCss};color:${T.soft};font-family:${st.bodyFont}">${b.html}</span></div>`;
  }).join("");

  let button = "";
  if (content.cta) {
    const fill = st.buttonFill === "outline"
      ? `background:transparent;color:${st.accent};border:1.6px solid ${st.accent}`
      : st.buttonFill === "soft"
        ? `background:${tint(st.accent, 0.14)};color:${st.accent};border:1.6px solid transparent`
        : `background:${st.accent};color:${contrast(st.accent)};border:1.6px solid ${st.accent}`;
    const shadow = st.buttonShadow ? `box-shadow:0 8px 20px ${tint(st.accent, 0.4)};` : "";
    const disp = st.buttonFullWidth ? "display:block;width:100%;box-sizing:border-box;" : "display:inline-block;";
    button = `<div style="padding:8px ${px}px ${px}px;text-align:${st.align}"><a href="${esc(content.cta.url)}" style="${disp}${fill};${shadow}border-radius:${st.buttonRadiusPx}px;padding:${st.buttonPadCss};font-size:${st.buttonFontPx}px;font-weight:700;font-family:${st.headingFont};text-align:center;text-decoration:none">${content.cta.label}${st.buttonArrow ? " &rarr;" : ""}</a></div>`;
  }

  let footer = "";
  if (st.footerStyle !== "none") {
    const line = content.footerText ?? `Sent by ${esc(opts.identityName)}`;
    if (st.footerStyle === "band") {
      footer = `<div style="background:${tint(st.accent, 0.1)};color:${st.accent};font-weight:600;font-size:11.5px;padding:16px ${px}px;font-family:${st.bodyFont}">${line}</div>`;
    } else {
      const rule = dividerCss(st, T.rule) || `1px solid ${T.rule}`;
      footer = `<div style="margin:0 ${px}px;border-top:${rule}"></div><div style="color:${T.mut};font-size:11.5px;padding:16px ${px}px;font-family:${st.bodyFont}">${line}</div>`;
    }
  }

  const hero = st.heroPhoto && st.headerStyle !== "banner" ? `<div style="height:140px;background:${bannerBg(st)}"></div>` : "";
  const trailing = content.trailingHtml ? `<div style="padding:4px ${px}px 0;font-family:${st.bodyFont}">${content.trailingHtml}</div>` : "";
  const border = st.cardBorder ? `border:1px solid ${T.rule};` : "";
  const shadowCss = st.cardShadowCss && st.cardShadowCss !== "none" ? `box-shadow:${st.cardShadowCss};` : "";
  const pre = content.preheaderText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(content.preheaderText)}</div>` : "";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${st.pageBg};-webkit-font-smoothing:antialiased">${pre}<div style="max-width:${st.maxWidthPx + 24}px;margin:0 auto;padding:24px 12px"><div style="max-width:${st.maxWidthPx}px;margin:0 auto;background:${st.cardBg};border-radius:${st.cardRadiusPx}px;overflow:hidden;${border}${shadowCss}">${header(st, content, T, mark, opts.identityName)}${hero}<div style="padding:${px}px ${px}px 4px;text-align:${st.align}">${greeting}${content.bodyHtml ?? blocks}</div>${button}${trailing}${footer}</div></div></body></html>`;
}

// Sample content for the three preview types — used by the "Send test" button so
// an operator can mail themselves exactly what a given look produces.
const SAMPLE = {
  milestone: { eye: "Milestone update", hl: "Your mortgage valuation is booked", lead: "Good news on your purchase.", p1: "Your lender has arranged a valuation of the property and will attend next week.", p2: "If you haven't booked your own survey yet, now is a good time. We'll let you know as soon as the offer follows.", cta: "View your portal" },
  invite: { eye: "You're invited", hl: "Track your sale, every step of the way", lead: "Welcome.", p1: "Your own private portal shows exactly where your sale is up to, what happens next, and who to contact.", p2: "Tap below to open your portal. No password needed, the link is yours.", cta: "Open your portal" },
  completion: { eye: "Completion confirmed", hl: "It's done. The keys are yours", lead: "Congratulations.", p1: "Completion has gone through, the funds have transferred and ownership has passed to you.", p2: "Keep your completion statement safe. We'll confirm Land Registry registration once it's processed.", cta: "View completion" },
};
export type SamplePreviewKey = keyof typeof SAMPLE;

export function renderStudioSampleEmail(theme: EmailThemeInput | null, pv: SamplePreviewKey, opts: StudioRenderOpts & { logoMode?: LogoMode }): string {
  const st = resolveStudioTheme(theme);
  if (opts.logoMode) st.logoMode = opts.logoMode;
  const c = SAMPLE[pv] ?? SAMPLE.milestone;
  return renderStudioEmail(st, {
    eyebrow: c.eye, headline: c.hl, lead: c.lead, greeting: "Hi Daniel,",
    blocks: [{ html: c.p1 }, { html: c.p2 }],
    cta: { label: c.cta, url: "#" },
    footerText: `Sent by ${opts.identityName} · This is a test of your email design.`,
    preheaderText: "A test of your email design.",
  }, opts);
}
