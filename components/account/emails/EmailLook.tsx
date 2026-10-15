"use client";

// Shared email-look renderer — the ONE visual engine behind both the Style tab's
// live preview (EmailStudio) and the Words tab's step-by-step preview, so a
// milestone email renders byte-for-byte in the branding the director chose.
//
// Takes a resolved StudioTheme + content slots and renders header / body /
// button / footer exactly as the send look does. Slots may be editable
// (contentEditable) for the Words edit-in-place flow, and sections may be
// wrapped (for EmailStudio's click-any-part-to-edit affordance).
//
// Ported faithfully from EmailStudio's preview components, so output matches the
// Style tab byte-for-byte. KEEP IN SYNC with EmailStudio's render until that
// component is migrated onto this shared file (the planned follow-up, kept
// separate for now so the working Style page is never at risk).

import { createElement, useEffect, useRef } from "react";
import { tint, luminance, type StudioTheme } from "@/lib/email/email-theme-studio";

// ── theme-derived helpers (shared with the send look) ───────────────────────
const SCENES = [
  "linear-gradient(120deg,#2b4a6b,#8aa0b5 60%,#c9b79c)",
  "linear-gradient(120deg,#3a5a40,#7a9b6e 55%,#c8d6a8)",
  "linear-gradient(120deg,#4a4e69,#9a8c98 55%,#c9ada7)",
  "linear-gradient(120deg,#6b4423,#b08968 55%,#e6ccb2)",
];
export function bannerBg(st: StudioTheme): string {
  const ov = (st.bannerOverlay || 0) / 100;
  return `linear-gradient(rgba(0,0,0,${ov}),rgba(0,0,0,${ov})),${SCENES[st.bannerScene] || SCENES[0]}`;
}
export function contrast(hexColor: string): string { return luminance(hexColor) > 0.52 ? "#1a1a1a" : "#ffffff"; }
export function dividerCss(st: StudioTheme, rule: string): string {
  if (st.dividerStyle === "none") return "";
  if (st.dividerStyle === "hairline") return `1px solid ${rule}`;
  if (st.dividerStyle === "thick") return `2px solid ${st.accent}`;
  return `1px dashed ${rule}`;
}
export function bodyInk(cardBg: string) {
  const dark = luminance(cardBg) < 0.4;
  return dark
    ? { main: "#F3F0EB", soft: "rgba(243,240,235,.82)", mut: "rgba(243,240,235,.55)", rule: "rgba(255,255,255,.13)" }
    : { main: "#1a1a1a", soft: "#33302b", mut: "#9a948a", rule: "rgba(20,16,10,.1)" };
}
export function initials(name: string): string { const w = name.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x)); return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "A"; }

// ── content model ───────────────────────────────────────────────────────────
export type Slot = { text: string; onEdit?: (v: string) => void; placeholder?: string };
export type EmailLookContent = {
  eyebrow: string;
  headline: Slot;
  lead?: Slot | null;
  greeting?: string | null;
  body: Slot[];
  cta: Slot;
};
// Section wrapper — EmailStudio passes one to add its es-edit click targets; the
// Words tab leaves it as identity.
export type SectionWrap = (region: "header" | "type" | "button" | "finish", node: React.ReactNode, tip: string) => React.ReactNode;

// One editable-or-static text node, rendered as the given tag so the headline
// stays an h1, paragraphs stay p, etc. Seeded once so the caret can't jump.
function EditableInline({ tag, slot, style, placeholder, singleLine }: { tag: string; slot: Slot; style: React.CSSProperties; placeholder?: string; singleLine?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (slot.onEdit && ref.current) ref.current.textContent = slot.text;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!slot.onEdit) return createElement(tag, { style }, slot.text);
  return createElement(tag, {
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    className: "emlook-edit",
    style,
    onInput: (e: React.FormEvent<HTMLElement>) => slot.onEdit?.((e.currentTarget as HTMLElement).textContent ?? ""),
    onKeyDown: (e: React.KeyboardEvent) => { if (singleLine && e.key === "Enter") e.preventDefault(); },
  });
}

function BrandMark({ st, sz, bg, fg, identityName, logo, tileColor }: { st: StudioTheme; sz: number; bg: string; fg: string; identityName: string; logo: string | null; tileColor: string }) {
  if (st.logoMode === "logo" && logo) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", background: tileColor, padding: `${Math.round(sz * 0.16)}px ${Math.round(sz * 0.34)}px`, borderRadius: st.cardRadiusPx === 0 ? 0 : 9 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" style={{ height: Math.round(sz * 0.62), maxWidth: 170, objectFit: "contain", display: "block" }} />
      </span>
    );
  }
  if (st.logoMode === "wordmark" || (st.logoMode === "logo" && !logo)) {
    return <span style={{ fontFamily: st.headingFont, fontWeight: 800, fontSize: Math.round(sz * 0.46), letterSpacing: "-0.01em", color: fg }}>{identityName}</span>;
  }
  const ring = fg === "#ffffff" || fg === "#fff" ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.14)";
  return <div style={{ width: sz, height: sz, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: Math.round(sz * 0.38), background: bg, color: fg, boxShadow: `inset 0 0 0 1.5px ${ring}`, flex: "none" }}>{initials(identityName)}</div>;
}

function Header({ st, content, T, mark, identityName }: { st: StudioTheme; content: EmailLookContent; T: ReturnType<typeof bodyInk>; mark: (sz: number, bg: string, fg: string) => React.ReactNode; identityName: string }) {
  const px = st.contentPadX;
  const eyebrow = (col: string) => st.showEyebrow ? <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: st.trackingCss === "0em" || st.trackingCss === "0" ? "0.12em" : st.trackingCss, textTransform: "uppercase", color: col }}>{content.eyebrow}</p> : null;
  const hlStyle = (col: string): React.CSSProperties => ({ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: st.headingWeightNum, letterSpacing: st.trackingCss, color: col, lineHeight: 1.16 });
  const hl = (col: string) => <EditableInline tag="h1" slot={content.headline} style={hlStyle(col)} placeholder="Headline" singleLine />;
  const leadEl = (col: string, extra?: React.CSSProperties) =>
    content.lead ? <EditableInline tag="p" slot={content.lead} style={{ margin: "9px 0 0", fontSize: 14, color: col, ...extra }} placeholder="Lead line" singleLine /> : null;

  if (st.headerStyle === "none") return <div style={{ padding: `${px}px ${px}px 0`, textAlign: st.align }}>{mark(40, tint(st.accent, 0.12), st.accent)}</div>;
  if (st.headerStyle === "minimal") return (
    <div style={{ padding: `${px}px ${px}px 20px`, borderBottom: `3px solid ${st.accent}`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 14 }}>{mark(40, tint(st.accent, 0.14), st.accent)}</div>{eyebrow(st.accent)}{hl(T.main)}
    </div>
  );
  if (st.headerStyle === "logoband") {
    const bandBg = luminance(st.cardBg) < 0.4 ? tint(st.accent, 0.16) : (luminance(st.c1) > 0.6 ? tint(st.c1, 0.2) : "#ffffff");
    return (<>
      <div style={{ background: bandBg, padding: `13px ${px}px`, display: "flex", alignItems: "center", gap: 10, borderBottom: `3px solid ${st.accent}` }}>{mark(28, st.headerBg, contrast(st.c1))}{st.logoMode !== "wordmark" && <span style={{ fontFamily: st.headingFont, fontWeight: 800, fontSize: 15, color: T.main }}>{identityName}</span>}</div>
      <div style={{ padding: `20px ${px}px 0`, textAlign: st.align }}>{eyebrow(st.accent)}{hl(T.main)}</div>
    </>);
  }
  if (st.headerStyle === "banner") return (
    <div style={{ background: bannerBg(st), padding: `${px + 16}px ${px}px`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 12 }}>{mark(40, tint("#ffffff", 0.2), "#fff")}</div>{eyebrow("#fff")}
      <EditableInline tag="h1" slot={content.headline} style={{ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: st.headingWeightNum, letterSpacing: st.trackingCss, color: "#fff", textShadow: "0 1px 10px rgba(0,0,0,.4)", lineHeight: 1.16 }} placeholder="Headline" singleLine />
      {leadEl("#fff")}
    </div>
  );
  const tx = contrast(st.c1), cen = st.headerStyle === "centered" ? "center" : st.align;
  const bg = st.headerStyle === "duotone" ? `linear-gradient(${st.gradAngle}deg,${st.c1} 0%,${st.c1} 55%,${st.accent} 100%)` : st.headerBg;
  return (
    <div style={{ background: bg, padding: `${px + 2}px ${px}px`, textAlign: cen }}>
      <div style={{ display: cen === "center" ? "inline-block" : "block", marginBottom: 14 }}>{mark(40, tint(tx === "#ffffff" ? "#ffffff" : "#000000", 0.16), tx)}</div>{eyebrow(tx)}{hl(tx)}
      {leadEl(tx, { opacity: 0.92 })}
    </div>
  );
}

function Block({ st, slot, T, first }: { st: StudioTheme; slot: Slot; T: ReturnType<typeof bodyInk>; first?: boolean }) {
  const card = st.sectionStyle === "cards";
  const style: React.CSSProperties = card
    ? { border: `1px solid ${T.rule}`, borderRadius: st.cardRadiusPx === 0 ? 0 : 10, padding: "14px 16px", marginBottom: 12 }
    : { marginBottom: 14, ...(first ? {} : { paddingTop: 14, marginTop: 2, borderTop: dividerCss(st, T.rule) || undefined }) };
  return <EditableInline tag="p" slot={slot} style={{ margin: 0, ...style, fontSize: 14.5, lineHeight: st.leadingCss, color: T.soft, fontFamily: st.bodyFont }} placeholder={slot.placeholder} />;
}

function Button({ st, slot }: { st: StudioTheme; slot: Slot }) {
  const fill = st.buttonFill === "outline"
    ? { background: "transparent", color: st.accent, border: `1.6px solid ${st.accent}` }
    : st.buttonFill === "soft"
      ? { background: tint(st.accent, 0.14), color: st.accent, border: "1.6px solid transparent" }
      : { background: st.accent, color: contrast(st.accent), border: `1.6px solid ${st.accent}` };
  const style: React.CSSProperties = { display: st.buttonFullWidth ? "block" : "inline-block", width: st.buttonFullWidth ? "100%" : undefined, borderRadius: st.buttonRadiusPx, padding: st.buttonPadCss, fontSize: st.buttonFontPx, fontWeight: 700, fontFamily: st.headingFont, textAlign: "center", textDecoration: "none", boxShadow: st.buttonShadow ? `0 8px 20px ${tint(st.accent, 0.4)}` : undefined, ...fill };
  if (slot.onEdit) return <EditableInline tag="span" slot={slot} style={style} placeholder={slot.placeholder ?? "Button label"} singleLine />;
  return <a href="#" onClick={(e) => e.preventDefault()} style={style}>{slot.text}{st.buttonArrow ? " →" : ""}</a>;
}

function Footer({ st, T, identityName }: { st: StudioTheme; T: ReturnType<typeof bodyInk>; identityName: string }) {
  if (st.footerStyle === "none") return null;
  const px = st.contentPadX;
  if (st.footerStyle === "band") return <div style={{ background: tint(st.accent, 0.1), color: st.accent, fontWeight: 600, fontSize: 11.5, padding: `16px ${px}px`, fontFamily: st.bodyFont }}>Sent by {identityName} · Manage your preferences any time.</div>;
  return (<>
    <div style={{ margin: `0 ${px}px`, borderTop: dividerCss(st, T.rule) || `1px solid ${T.rule}` }} />
    <div style={{ color: T.mut, fontSize: 11.5, padding: `16px ${px}px`, fontFamily: st.bodyFont }}>Sent by {identityName} · You are receiving this because you are party to this sale.</div>
  </>);
}

const IDENTITY_WRAP: SectionWrap = (_region, node) => node;

// The full email card. `wrap` lets EmailStudio add its click-to-edit targets;
// omit it (or leave default) for a plain render.
export function EmailLookCard({
  st,
  content,
  identityName,
  logo,
  tileColor,
  wrap = IDENTITY_WRAP,
  busy,
}: {
  st: StudioTheme;
  content: EmailLookContent;
  identityName: string;
  logo: string | null;
  tileColor: string;
  wrap?: SectionWrap;
  busy?: boolean;
}) {
  const T = bodyInk(st.cardBg);
  const px = st.contentPadX;
  const alignCss = st.align as "left" | "center";
  const mark = (sz: number, bg: string, fg: string) => <BrandMark st={st} sz={sz} bg={bg} fg={fg} identityName={identityName} logo={logo} tileColor={tileColor} />;
  return (
    <div style={{ width: "100%", maxWidth: st.maxWidthPx, background: st.cardBg, borderRadius: st.cardRadiusPx, overflow: "hidden", boxShadow: st.cardShadowCss, border: st.cardBorder ? `1px solid ${T.rule}` : "none", transition: "all .2s", opacity: busy ? 0.75 : 1 }}>
      <style>{`.emlook-edit{outline:none;cursor:text;border-radius:3px;}.emlook-edit:empty:before{content:attr(data-placeholder);opacity:.5;pointer-events:none;}.emlook-edit:focus{outline:1.5px solid var(--agent-coral,#FF6B4A);outline-offset:3px;}`}</style>
      {wrap("header", <Header st={st} content={content} T={T} mark={mark} identityName={identityName} />, "Header")}
      {st.heroPhoto && st.headerStyle !== "banner" && <div style={{ height: 140, background: bannerBg(st) }} />}
      {wrap("type", (
        <div style={{ padding: `${px}px ${px}px 4px`, textAlign: alignCss }}>
          {content.greeting != null && <p style={{ margin: "0 0 15px", fontSize: 14.5, lineHeight: st.leadingCss, color: T.main, fontFamily: st.bodyFont }}>{content.greeting}</p>}
          {content.body.map((slot, i) => <Block key={i} st={st} slot={slot} T={T} first={i === 0} />)}
        </div>
      ), "Text")}
      {wrap("button", <div style={{ padding: `8px ${px}px ${px}px`, textAlign: alignCss }}><Button st={st} slot={content.cta} /></div>, "Button")}
      {wrap("finish", <Footer st={st} T={T} identityName={identityName} />, "Footer")}
    </div>
  );
}
