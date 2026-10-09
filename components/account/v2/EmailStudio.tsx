"use client";

// Email Studio (2026-10) — the expanded client-email designer. Pick a look from a
// style family (easy), or open Fine-tune for full control (optional). The live
// preview renders through the SAME resolver the send path will use
// (lib/email/email-theme-studio.ts), so it can't drift. Saves the expanded theme
// through the existing logo/theme endpoint (its PATCH already sanitises + stores
// the whole EmailThemeInput blob). Gated to a single operator for now by the
// mount sites — this component itself is identity-agnostic.

import { useMemo, useRef, useState } from "react";
import { LOGO_HEIGHTS, LOGO_BAND_PADDING_Y, LOGO_BAND_PADDING_X, LOGO_MAX_WIDTH } from "@/lib/email/logo-header";
import type { EmailThemeInput } from "@/lib/email/brand-theme";
import { resolveStudioTheme, tint, luminance, FONT_STACKS, LOOKS, LOOKS_BY_KEY, LOOK_CATEGORIES, type StudioTheme, type LookCategory } from "@/lib/email/email-theme-studio";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import type { BrandingInitial } from "@/components/account/v2/EmailBrandingStudio";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const ALLOWED = new Set(ACCEPT.split(","));
const HEX = /^#[0-9a-fA-F]{6}$/;
const SWATCHES = ["#FF6B4A", "#2563EB", "#0F2A5A", "#0EA5A4", "#16A34A", "#9A7B4F", "#C8A04A", "#E11D48", "#7C3AED", "#DB2777", "#2B2622", "#111111", "#FFFFFF", "#F6F2EC", "#14110D"];
const PALETTES: Array<{ n: string; headerColor: string; headerColor2: string; accentColor: string; cardBg: string; pageBg: string }> = [
  { n: "Coral", headerColor: "#FF8A65", headerColor2: "#FFB74D", accentColor: "#FF6B4A", cardBg: "#FFFFFF", pageBg: "#ECEAE6" },
  { n: "Ocean", headerColor: "#2563EB", headerColor2: "#2563EB", accentColor: "#2563EB", cardBg: "#FFFFFF", pageBg: "#EEF2FB" },
  { n: "Forest", headerColor: "#14532D", headerColor2: "#166534", accentColor: "#16A34A", cardBg: "#FFFFFF", pageBg: "#EEF3EE" },
  { n: "Navy/Gold", headerColor: "#0F2A5A", headerColor2: "#0F2A5A", accentColor: "#C8A04A", cardBg: "#FFFFFF", pageBg: "#ECEEF2" },
  { n: "Noir", headerColor: "#111111", headerColor2: "#111111", accentColor: "#111111", cardBg: "#FFFFFF", pageBg: "#E9E9E9" },
  { n: "Midnight", headerColor: "#1E293B", headerColor2: "#0EA5A4", accentColor: "#38BDF8", cardBg: "#0F172A", pageBg: "#060A12" },
  { n: "Blush", headerColor: "#F6D9D0", headerColor2: "#EFC7D6", accentColor: "#D1668A", cardBg: "#FFFCFB", pageBg: "#F3E8E6" },
  { n: "Teal", headerColor: "#0EA5A4", headerColor2: "#22C55E", accentColor: "#0EA5A4", cardBg: "#FFFFFF", pageBg: "#E7F3F2" },
];

const PREVIEW = {
  milestone: { eye: "Milestone update", hl: "Your mortgage valuation is booked", lead: "Good news on your purchase.", k1: "What happened", p1: "Your lender has arranged a valuation of the property and will attend next week.", k2: "What next", p2: "If you haven't booked your own survey yet, now is a good time. We'll let you know as soon as the offer follows.", cta: "View your portal" },
  invite: { eye: "You're invited", hl: "Track your sale, every step of the way", lead: "Welcome.", k1: "What this is", p1: "Your own private portal shows exactly where your sale is up to, what happens next, and who to contact.", k2: "Getting started", p2: "Tap below to open your portal. No password needed, the link is yours.", cta: "Open your portal" },
  completion: { eye: "Completion confirmed", hl: "It's done. The keys are yours", lead: "Congratulations.", k1: "What happened", p1: "Completion has gone through, the funds have transferred and ownership has passed to you.", k2: "What next", p2: "Keep your completion statement safe. We'll confirm Land Registry registration once it's processed.", cta: "View completion" },
};
type PreviewKey = keyof typeof PREVIEW;

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
}
function contrast(hexColor: string): string { return luminance(hexColor) > 0.52 ? "#1a1a1a" : "#ffffff"; }
function dividerCss(th: StudioTheme, rule: string): string {
  if (th.dividerStyle === "none") return "";
  if (th.dividerStyle === "hairline") return `1px solid ${rule}`;
  if (th.dividerStyle === "thick") return `2px solid ${th.accent}`;
  return `1px dashed ${rule}`;
}
function photo(hexColor: string): string {
  return `linear-gradient(135deg,${tint(hexColor, 0.85)},${tint(hexColor, 0.5)}),radial-gradient(circle at 70% 20%,rgba(255,255,255,.35),transparent 50%),linear-gradient(180deg,#8aa0b5,#566d82)`;
}
function bodyInk(cardBg: string) {
  const dark = luminance(cardBg) < 0.4;
  return dark
    ? { main: "#F3F0EB", soft: "rgba(243,240,235,.82)", mut: "rgba(243,240,235,.55)", rule: "rgba(255,255,255,.13)" }
    : { main: "#1a1a1a", soft: "#33302b", mut: "#9a948a", rule: "rgba(20,16,10,.1)" };
}

export function EmailStudio({ initial, endpoint = "/api/agent/agency-logo", identityName = "Your agency" }: { initial: BrandingInitial; endpoint?: string; identityName?: string }) {
  // logo
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [tileColor, setTileColor] = useState(initial.tileColor ?? "#ffffff");
  const [scale, setScale] = useState<LogoScale>(initial.scale ?? "md");
  const [align, setAlign] = useState<LogoAlign>(initial.align ?? "left");
  // theme
  const [theme, setTheme] = useState<EmailThemeInput>(initial.theme ?? {});
  const [lookKey, setLookKey] = useState<string>(detectLook(initial.theme ?? {}));
  // ui
  const [cat, setCat] = useState<LookCategory | "all">("all");
  const [ftOpen, setFtOpen] = useState(false);
  const [ftTab, setFtTab] = useState("type");
  const [pv, setPv] = useState<PreviewKey>("milestone");
  const [busy, setBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const themeJson = JSON.stringify(theme);
  const [savedJson, setSavedJson] = useState(themeJson);
  const [savedLogo, setSavedLogo] = useState({ tileColor: initial.tileColor ?? "#ffffff", scale: initial.scale ?? ("md" as LogoScale), align: initial.align ?? ("left" as LogoAlign) });
  const dirty = themeJson !== savedJson || tileColor !== savedLogo.tileColor || scale !== savedLogo.scale || align !== savedLogo.align;

  const st = useMemo(() => resolveStudioTheme(theme), [theme]);
  const shownLogo = localPreview ?? logoUrl;

  function patch(p: Partial<EmailThemeInput>) { setTheme((t) => ({ ...t, ...p })); setLookKey("custom"); setSavingState("idle"); }
  function applyLook(key: string) { const l = LOOKS_BY_KEY[key]; if (!l) return; setTheme({ ...l.theme }); setLookKey(key); setSavingState("idle"); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (inputRef.current) inputRef.current.value = ""; if (!file) return;
    setError(null);
    if (!ALLOWED.has(file.type)) { setError("Please choose a PNG, JPG, WebP or SVG."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    setLocalPreview(URL.createObjectURL(file)); setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataBase64, mimetype: file.type }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); setLocalPreview(null); return; }
      setLogoUrl(`${json.url}?t=${Date.now()}`); setLocalPreview(null); setTileColor(json.tileColor); setScale(json.scale); setAlign(json.align);
      setSavedLogo({ tileColor: json.tileColor, scale: json.scale, align: json.align });
    } catch { setError("Upload failed. Try again."); setLocalPreview(null); } finally { setBusy(false); }
  }
  async function onSave() {
    setSavingState("saving"); setError(null);
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tileColor, scale, align, theme }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't save your changes."); setSavingState("idle"); return; }
      setSavedJson(themeJson); setSavedLogo({ tileColor, scale, align }); setSavingState("saved");
    } catch { setError("Couldn't save your changes."); setSavingState("idle"); }
  }

  const looks = LOOKS.filter((l) => cat === "all" || l.cat === cat);

  return (
    <div className="es-grid">
      {/* controls */}
      <div className="es-controls">
        <p className="es-step">Step 1</p>
        <p className="es-steph">Choose a look</p>
        <div className="es-cats">
          {LOOK_CATEGORIES.map((c) => (
            <button key={c.key} type="button" className={`es-cat${c.key === cat ? " on" : ""}`} onClick={() => setCat(c.key as LookCategory | "all")}>{c.label}</button>
          ))}
        </div>
        <div className="es-looks">
          {looks.map((l) => (
            <button key={l.key} type="button" className={`es-look${l.key === lookKey ? " on" : ""}`} onClick={() => applyLook(l.key)}>
              <Thumb theme={l.theme} />
              <span className="es-lk-meta"><b>{l.label}</b><span>{l.tag}</span></span>
            </button>
          ))}
        </div>

        {/* fine-tune */}
        <div className={`es-ft${ftOpen ? " open" : ""}`}>
          <button type="button" className="es-ft-toggle" onClick={() => setFtOpen((o) => !o)}>
            <span className="es-ft-l"><span className="es-ft-ic">✎</span><span className="es-ft-tt">Fine-tune your design<small>Optional. Type, colour, header, layout, buttons.</small></span></span>
            <span className="es-chev">▸</span>
          </button>
          {ftOpen && (
            <div className="es-ft-body">
              <div className="es-ptabs">
                {["type", "colour", "header", "layout", "button", "finish"].map((t) => (
                  <button key={t} type="button" className={`es-ptab${ftTab === t ? " on" : ""}`} onClick={() => setFtTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
                ))}
              </div>

              {ftTab === "type" && (
                <>
                  <Ctl label="Type pairing"><div className="es-row">{(Object.keys(FONT_STACKS) as Array<keyof typeof FONT_STACKS>).map((k) => (
                    <button key={k} type="button" className={`es-chip${(theme.typeSystem ?? "humanist") === k ? " on" : ""}`} style={{ fontFamily: FONT_STACKS[k].heading }} onClick={() => patch({ typeSystem: k })}>{FONT_STACKS[k].label}</button>
                  ))}</div></Ctl>
                  <Chips label="Headline size" cur={theme.headingSize ?? "l"} opts={[["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]]} on={(v) => patch({ headingSize: v as EmailThemeInput["headingSize"] })} />
                  <Chips label="Headline weight" cur={theme.headingWeight ?? "800"} opts={[["400", "Light"], ["600", "Medium"], ["800", "Bold"], ["900", "Black"]]} on={(v) => patch({ headingWeight: v as EmailThemeInput["headingWeight"] })} />
                  <Chips label="Line spacing" cur={theme.leading ?? "normal"} opts={[["tight", "Tight"], ["normal", "Normal"], ["airy", "Airy"]]} on={(v) => patch({ leading: v as EmailThemeInput["leading"] })} />
                  <Chips label="Letter spacing" cur={theme.tracking ?? "normal"} opts={[["tight", "Tight"], ["normal", "Normal"], ["wide", "Wide"]]} on={(v) => patch({ tracking: v as EmailThemeInput["tracking"] })} />
                  <Chips label="Alignment" cur={theme.align ?? "left"} opts={[["left", "Left"], ["center", "Centre"]]} on={(v) => patch({ align: v as EmailThemeInput["align"] })} />
                </>
              )}
              {ftTab === "colour" && (
                <>
                  <Ctl label="Palettes"><div className="es-palrow">{PALETTES.map((p, i) => (
                    <button key={i} type="button" className="es-pal" title={p.n} onClick={() => patch({ headerColor: p.headerColor, headerColor2: p.headerColor2, accentColor: p.accentColor, cardBg: p.cardBg, pageBg: p.pageBg })}>
                      <i style={{ background: p.headerColor }} /><i style={{ background: p.accentColor }} /><i style={{ background: p.cardBg }} />
                    </button>
                  ))}</div></Ctl>
                  <Swatches label="Header" cur={theme.headerColor ?? "#FF8A65"} on={(v) => patch({ headerColor: v })} />
                  {(st.headerStyle === "gradient" || st.headerStyle === "duotone") && <Swatches label="Gradient to" cur={theme.headerColor2 ?? "#FFB74D"} on={(v) => patch({ headerColor2: v })} />}
                  <Swatches label="Accent (buttons & links)" cur={theme.accentColor ?? "#FF6B4A"} on={(v) => patch({ accentColor: v })} />
                  <Swatches label="Card background" cur={theme.cardBg ?? "#FFFFFF"} on={(v) => patch({ cardBg: v })} />
                  <Swatches label="Page background" cur={theme.pageBg ?? "#f4f4f6"} on={(v) => patch({ pageBg: v })} />
                </>
              )}
              {ftTab === "header" && (
                <>
                  <Chips label="Header style" cur={theme.headerStyle ?? "gradient"} opts={[["gradient", "Gradient"], ["solid", "Solid"], ["minimal", "Minimal"], ["logoband", "Logo band"], ["banner", "Photo banner"], ["centered", "Centered"], ["duotone", "Duotone"], ["none", "No header"]]} on={(v) => patch({ headerStyle: v as EmailThemeInput["headerStyle"] })} />
                  <Toggle label="Show eyebrow label" on={theme.showEyebrow ?? true} toggle={() => patch({ showEyebrow: !(theme.showEyebrow ?? true) })} />
                  <Toggle label="Property photo banner" on={theme.heroPhoto ?? false} toggle={() => patch({ heroPhoto: !(theme.heroPhoto ?? false) })} />
                  <LogoControls logoUrl={logoUrl} busy={busy} inputRef={inputRef} onFile={onFile} tileColor={tileColor} setTileColor={(v) => { setTileColor(v); setSavingState("idle"); }} scale={scale} setScale={(v) => { setScale(v); setSavingState("idle"); }} align={align} setAlign={(v) => { setAlign(v); setSavingState("idle"); }} />
                </>
              )}
              {ftTab === "layout" && (
                <>
                  <Chips label="Email width" cur={theme.width ?? "standard"} opts={[["narrow", "Narrow"], ["standard", "Standard"], ["wide", "Wide"]]} on={(v) => patch({ width: v as EmailThemeInput["width"] })} />
                  <Chips label="Spacing" cur={theme.density ?? "comfy"} opts={[["cozy", "Cozy"], ["comfy", "Comfortable"], ["roomy", "Roomy"]]} on={(v) => patch({ density: v as EmailThemeInput["density"] })} />
                  <Chips label="Section style" cur={theme.sectionStyle ?? "plain"} opts={[["plain", "Flowing"], ["cards", "Cards"]]} on={(v) => patch({ sectionStyle: v as EmailThemeInput["sectionStyle"] })} />
                  <Chips label="Dividers" cur={theme.dividerStyle ?? "none"} opts={[["none", "None"], ["hairline", "Hairline"], ["thick", "Bold rule"], ["dotted", "Dotted"]]} on={(v) => patch({ dividerStyle: v as EmailThemeInput["dividerStyle"] })} />
                </>
              )}
              {ftTab === "button" && (
                <>
                  <Chips label="Fill" cur={theme.buttonFill ?? "filled"} opts={[["filled", "Filled"], ["soft", "Soft"], ["outline", "Outline"]]} on={(v) => patch({ buttonFill: v as EmailThemeInput["buttonFill"] })} />
                  <Chips label="Shape" cur={theme.buttonShape ?? "rounded"} opts={[["rounded", "Rounded"], ["pill", "Pill"], ["square", "Square"]]} on={(v) => patch({ buttonShape: v as EmailThemeInput["buttonShape"] })} />
                  <Chips label="Size" cur={theme.buttonSize ?? "md"} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} on={(v) => patch({ buttonSize: v as EmailThemeInput["buttonSize"] })} />
                  <Toggle label="Full-width button" on={theme.buttonFullWidth ?? false} toggle={() => patch({ buttonFullWidth: !(theme.buttonFullWidth ?? false) })} />
                  <Toggle label="Button shadow" on={theme.buttonShadow ?? false} toggle={() => patch({ buttonShadow: !(theme.buttonShadow ?? false) })} />
                  <Toggle label="Arrow on button" on={theme.buttonArrow ?? true} toggle={() => patch({ buttonArrow: !(theme.buttonArrow ?? true) })} />
                </>
              )}
              {ftTab === "finish" && (
                <>
                  <Chips label="Corners" cur={theme.bandShape ?? "rounded"} opts={[["rounded", "Rounded"], ["square", "Square"]]} on={(v) => patch({ bandShape: v as EmailThemeInput["bandShape"] })} />
                  <Chips label="Card shadow" cur={theme.cardShadow ?? "soft"} opts={[["none", "None"], ["soft", "Soft"], ["strong", "Strong"]]} on={(v) => patch({ cardShadow: v as EmailThemeInput["cardShadow"] })} />
                  <Chips label="Footer" cur={theme.footerStyle ?? "band"} opts={[["none", "None"], ["simple", "Simple"], ["band", "Coloured band"]]} on={(v) => patch({ footerStyle: v as EmailThemeInput["footerStyle"] })} />
                  <Toggle label="Card border" on={theme.cardBorder ?? false} toggle={() => patch({ cardBorder: !(theme.cardBorder ?? false) })} />
                </>
              )}
            </div>
          )}
        </div>

        <div className="es-save">
          {!dirty && savingState === "saved" && <span className="es-saved">Saved</span>}
          <button type="button" className="es-save2" onClick={onSave} disabled={!dirty || savingState === "saving"}>{savingState === "saving" ? "Saving…" : "Save changes"}</button>
        </div>
        {error && <p className="es-err" role="alert">{error}</p>}
      </div>

      {/* preview */}
      <div className="es-right">
        <div className="es-pv-top">
          <span className="es-pv-cap">Live preview</span>
          <div className="es-tabs">{(Object.keys(PREVIEW) as PreviewKey[]).map((k) => (
            <button key={k} type="button" className={`es-tab${pv === k ? " on" : ""}`} onClick={() => setPv(k)}>{k === "milestone" ? "Milestone" : k === "invite" ? "Invite" : "Completion"}</button>
          ))}</div>
        </div>
        <div className="es-stage" style={{ background: st.pageBg }}>
          <PreviewEmail st={st} pv={pv} identityName={identityName} logo={shownLogo} tileColor={tileColor} scale={scale} align={align} busy={busy} />
        </div>
        <p className="es-cap">Preview exactly what your buyers and sellers receive.</p>
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

// ── preview email ──
function PreviewEmail({ st, pv, identityName, logo, tileColor, scale, align, busy }: { st: StudioTheme; pv: PreviewKey; identityName: string; logo: string | null; tileColor: string; scale: LogoScale; align: LogoAlign; busy: boolean }) {
  const c = PREVIEW[pv];
  const T = bodyInk(st.cardBg);
  const px = st.contentPadX;
  const shadowCss = st.cardShadow === "none" ? "none" : st.cardShadow === "strong" ? "0 22px 60px rgba(20,14,8,.32)" : "0 10px 30px rgba(20,14,8,.14)";
  const alignCss = st.align as "left" | "center";

  const logoBand = logo ? (
    <div style={{ background: tileColor, padding: `${LOGO_BAND_PADDING_Y[scale]}px ${LOGO_BAND_PADDING_X}px`, textAlign: align === "center" ? "center" : "left" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" style={{ height: LOGO_HEIGHTS[scale], maxWidth: LOGO_MAX_WIDTH, objectFit: "contain", display: align === "center" ? "inline-block" : "block", opacity: busy ? 0.5 : 1 }} />
    </div>
  ) : null;

  return (
    <div style={{ width: "100%", maxWidth: st.maxWidthPx, background: st.cardBg, borderRadius: st.cardRadiusPx, overflow: "hidden", boxShadow: shadowCss, border: st.cardBorder ? `1px solid ${T.rule}` : "none", transition: "all .2s" }}>
      {logoBand}
      <Header st={st} c={c} T={T} identityName={identityName} />
      {st.heroPhoto && st.headerStyle !== "banner" && <div style={{ height: 140, background: photo(st.c1) }} />}
      <div style={{ padding: `${px}px ${px}px 4px`, textAlign: alignCss }}>
        <p style={{ margin: "0 0 15px", fontSize: 14.5, lineHeight: st.leadingCss, color: T.main, fontFamily: st.bodyFont }}>Hi Daniel,</p>
        <Block st={st} k={c.k1} p={c.p1} T={T} first />
        <Block st={st} k={c.k2} p={c.p2} T={T} />
      </div>
      <div style={{ padding: `8px ${px}px ${px}px`, textAlign: alignCss }}><Button st={st} label={c.cta} /></div>
      <Footer st={st} T={T} identityName={identityName} />
    </div>
  );
}

function Header({ st, c, T, identityName }: { st: StudioTheme; c: typeof PREVIEW[PreviewKey]; T: ReturnType<typeof bodyInk>; identityName: string }) {
  const px = st.contentPadX;
  const eyebrow = (col: string) => st.showEyebrow ? <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: st.trackingCss === "0" ? "0.12em" : st.trackingCss, textTransform: "uppercase", color: col }}>{c.eye}</p> : null;
  const hl = (col: string) => <h1 style={{ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: Number(st.headingWeight), letterSpacing: st.trackingCss, color: col, lineHeight: 1.16 }}>{c.hl}</h1>;
  const lg = (sz: number, bg: string, fg: string) => <div style={{ width: sz, height: sz, borderRadius: st.cardRadiusPx === 0 ? 0 : 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: sz * 0.36, background: bg, color: fg, flex: "none" }}>{initials(identityName)}</div>;

  if (st.headerStyle === "none") return <div style={{ padding: `${px}px ${px}px 0`, textAlign: st.align }}>{lg(40, tint(st.accent, 0.12), st.accent)}</div>;
  if (st.headerStyle === "minimal") return (
    <div style={{ padding: `${px}px ${px}px 20px`, borderBottom: `3px solid ${st.accent}`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 14 }}>{lg(40, tint(st.accent, 0.14), st.accent)}</div>{eyebrow(st.accent)}{hl(T.main)}
    </div>
  );
  if (st.headerStyle === "logoband") {
    const bandBg = luminance(st.cardBg) < 0.4 ? tint(st.accent, 0.16) : (luminance(st.c1) > 0.6 ? tint(st.c1, 0.2) : "#ffffff");
    return (<>
      <div style={{ background: bandBg, padding: `13px ${px}px`, display: "flex", alignItems: "center", gap: 10, borderBottom: `3px solid ${st.accent}` }}>{lg(28, st.headerBg, contrast(st.c1))}<span style={{ fontFamily: st.headingFont, fontWeight: 800, fontSize: 15, color: T.main }}>{identityName}</span></div>
      <div style={{ padding: `20px ${px}px 0`, textAlign: st.align }}>{eyebrow(st.accent)}{hl(T.main)}</div>
    </>);
  }
  if (st.headerStyle === "banner") return (
    <div style={{ background: photo(st.c1), padding: `${px + 16}px ${px}px`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 12 }}>{lg(40, tint("#ffffff", 0.2), "#fff")}</div>{eyebrow("#fff")}
      <h1 style={{ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: Number(st.headingWeight), letterSpacing: st.trackingCss, color: "#fff", textShadow: "0 1px 10px rgba(0,0,0,.4)" }}>{c.hl}</h1>
      <p style={{ margin: "9px 0 0", fontSize: 14, color: "#fff" }}>{c.lead}</p>
    </div>
  );
  const tx = contrast(st.c1), cen = st.headerStyle === "centered" ? "center" : st.align;
  const bg = st.headerStyle === "duotone" ? `linear-gradient(135deg,${st.c1} 0%,${st.c1} 55%,${st.accent} 100%)` : st.headerBg;
  return (
    <div style={{ background: bg, padding: `${px + 2}px ${px}px`, textAlign: cen }}>
      <div style={{ display: cen === "center" ? "inline-block" : "block", marginBottom: 14 }}>{lg(40, tint(tx === "#ffffff" ? "#fff" : "#000", 0.16), tx)}</div>{eyebrow(tx)}{hl(tx)}
      <p style={{ margin: "9px 0 0", fontSize: 14, color: tx, opacity: 0.92 }}>{c.lead}</p>
    </div>
  );
}

function Block({ st, k, p, T, first }: { st: StudioTheme; k: string; p: string; T: ReturnType<typeof bodyInk>; first?: boolean }) {
  const card = st.sectionStyle === "cards";
  const style: React.CSSProperties = card
    ? { border: `1px solid ${T.rule}`, borderRadius: st.cardRadiusPx === 0 ? 0 : 10, padding: "14px 16px", marginBottom: 12 }
    : { marginBottom: 14, ...(first ? {} : { paddingTop: 14, marginTop: 2, borderTop: dividerCss(st, T.rule) || undefined }) };
  return (
    <div style={style}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3, color: card ? st.accent : T.mut }}>{k}</span>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: st.leadingCss, color: T.soft, fontFamily: st.bodyFont }}>{p}</p>
    </div>
  );
}

function Button({ st, label }: { st: StudioTheme; label: string }) {
  const base: React.CSSProperties = { display: st.buttonFullWidth ? "block" : "inline-block", width: st.buttonFullWidth ? "100%" : undefined, borderRadius: st.buttonRadiusPx, padding: st.buttonPadCss.split(" ").join(" "), fontSize: st.buttonFontPx, fontWeight: 700, fontFamily: st.headingFont, textAlign: "center", textDecoration: "none", boxShadow: st.buttonShadow ? `0 8px 20px ${tint(st.accent, 0.4)}` : undefined };
  const fill = st.buttonFill === "outline"
    ? { background: "transparent", color: st.accent, border: `1.6px solid ${st.accent}` }
    : st.buttonFill === "soft"
      ? { background: tint(st.accent, 0.14), color: st.accent, border: "1.6px solid transparent" }
      : { background: st.accent, color: contrast(st.accent), border: `1.6px solid ${st.accent}` };
  const pad = st.buttonPadCss;
  return <a href="#" onClick={(e) => e.preventDefault()} style={{ ...base, ...fill, padding: pad }}>{label}{st.buttonArrow ? " →" : ""}</a>;
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

// ── thumbnail (mini email per look) ──
function Thumb({ theme }: { theme: EmailThemeInput }) {
  const st = resolveStudioTheme(theme);
  const c = PREVIEW.milestone, T = bodyInk(st.cardBg);
  const light = st.headerStyle === "minimal" || st.headerStyle === "logoband" || st.headerStyle === "none";
  const head = light ? (
    <div style={{ background: st.cardBg, padding: "9px 10px 8px", borderBottom: `2px solid ${st.accent}` }}>
      {st.showEyebrow && <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: st.accent, marginBottom: 2 }}>{c.eye}</div>}
      <div style={{ fontSize: 9.5, fontWeight: 800, lineHeight: 1.1, color: T.main, fontFamily: st.headingFont }}>{c.hl}</div>
    </div>
  ) : (() => { const bg = st.headerStyle === "banner" ? photo(st.c1) : st.headerBg; const tc = st.headerStyle === "banner" ? "#fff" : contrast(st.c1); return (
    <div style={{ background: bg, padding: "9px 10px 8px" }}>
      {st.showEyebrow && <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tc, marginBottom: 2 }}>{c.eye}</div>}
      <div style={{ fontSize: 9.5, fontWeight: 800, lineHeight: 1.1, color: tc, fontFamily: st.headingFont }}>{c.hl}</div>
    </div>
  ); })();
  const bstyle: React.CSSProperties = st.buttonFill === "outline" ? { background: "transparent", color: st.accent, border: `1px solid ${st.accent}` } : st.buttonFill === "soft" ? { background: tint(st.accent, 0.14), color: st.accent } : { background: st.accent, color: contrast(st.accent) };
  return (
    <div style={{ background: st.cardBg, borderRadius: st.cardRadiusPx === 0 ? 0 : 6, overflow: "hidden", boxShadow: "0 2px 8px rgba(20,14,8,.16)" }}>
      {head}
      <div style={{ padding: "7px 10px 9px" }}>
        <div style={{ height: 3, background: T.rule, borderRadius: 2, marginBottom: 3, width: "85%" }} />
        <div style={{ height: 3, background: T.rule, borderRadius: 2, marginBottom: 7, width: "60%" }} />
        <span style={{ display: "inline-block", fontSize: 6, fontWeight: 700, padding: "3px 8px", borderRadius: st.buttonRadiusPx, ...bstyle }}>{c.cta}</span>
      </div>
    </div>
  );
}

// ── small control primitives ──
function Ctl({ label, children }: { label: string; children: React.ReactNode }) { return <div className="es-ctl"><p className="es-lbl">{label}</p>{children}</div>; }
function Chips({ label, cur, opts, on }: { label: string; cur: string; opts: Array<[string, string]>; on: (v: string) => void }) {
  return <Ctl label={label}><div className="es-row">{opts.map(([v, l]) => <button key={v} type="button" className={`es-chip${cur === v ? " on" : ""}`} onClick={() => on(v)}>{l}</button>)}</div></Ctl>;
}
function Swatches({ label, cur, on }: { label: string; cur: string; on: (v: string) => void }) {
  return <Ctl label={label}><div className="es-swrow">{SWATCHES.map((c) => <button key={c} type="button" className={`es-sw${cur.toLowerCase() === c.toLowerCase() ? " on" : ""}`} style={{ background: c }} onClick={() => on(c)} />)}<label className="es-cust"><input type="color" value={HEX.test(cur) ? cur : "#ffffff"} onChange={(e) => on(e.target.value)} />pick</label></div></Ctl>;
}
function Toggle({ label, on, toggle }: { label: string; on: boolean; toggle: () => void }) {
  return <div className="es-toggle"><span>{label}</span><button type="button" className={`es-tg${on ? " on" : ""}`} onClick={toggle}><i /></button></div>;
}
function LogoControls({ logoUrl, busy, inputRef, onFile, tileColor, setTileColor, scale, setScale, align, setAlign }: { logoUrl: string | null; busy: boolean; inputRef: React.RefObject<HTMLInputElement>; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; tileColor: string; setTileColor: (v: string) => void; scale: LogoScale; setScale: (v: LogoScale) => void; align: LogoAlign; setAlign: (v: LogoAlign) => void }) {
  return (
    <>
      <Ctl label="Logo"><div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="es-chip" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}</button>
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} />
        <label className="es-cust"><input type="color" value={HEX.test(tileColor) ? tileColor : "#ffffff"} onChange={(e) => setTileColor(e.target.value)} />background</label>
      </div></Ctl>
      <Chips label="Logo size" cur={scale} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} on={(v) => setScale(v as LogoScale)} />
      <Chips label="Logo alignment" cur={align} opts={[["left", "Left"], ["center", "Centre"]]} on={(v) => setAlign(v as LogoAlign)} />
    </>
  );
}

function initials(name: string): string { const w = name.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x)); return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "A"; }
function detectLook(theme: EmailThemeInput): string {
  const json = JSON.stringify(theme);
  for (const l of LOOKS) if (JSON.stringify(l.theme) === json) return l.key;
  return Object.keys(theme).length === 0 ? "coral" : "custom";
}

const STYLES = `
  .es-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:0;border:1px solid rgba(60,40,20,.12);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 30px -22px rgba(15,23,42,.4);}
  @media(max-width:860px){.es-grid{grid-template-columns:1fr;}}
  .es-controls{padding:20px 22px;min-width:0;border-right:1px solid rgba(60,40,20,.1);}
  @media(max-width:860px){.es-controls{border-right:none;border-bottom:1px solid rgba(60,40,20,.1);}}
  .es-step{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#E0552F;margin:0 0 3px;}
  .es-steph{font-size:16px;font-weight:800;margin:0 0 14px;letter-spacing:-0.01em;color:#2A2016;}
  .es-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
  .es-cat{font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid rgba(60,40,20,.12);background:#FBF8F4;color:#6E6355;cursor:pointer;transition:all .13s;}
  .es-cat:hover{border-color:#FF6B4A;color:#2A2016;} .es-cat.on{background:#2A2016;color:#fff;border-color:#2A2016;}
  .es-looks{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
  @media(min-width:1180px){.es-looks{grid-template-columns:repeat(3,1fr);}}
  .es-look{cursor:pointer;border:1.5px solid rgba(60,40,20,.12);border-radius:12px;overflow:hidden;background:#FBF8F4;padding:7px;transition:transform .14s,border-color .14s,box-shadow .14s;text-align:left;font:inherit;}
  .es-look:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(40,26,20,.12);}
  .es-look.on{border-color:#FF6B4A;box-shadow:0 0 0 3px rgba(255,107,74,.14);}
  .es-lk-meta{display:block;padding:7px 3px 2px;} .es-lk-meta b{font-size:12px;font-weight:700;display:block;color:#2A2016;} .es-lk-meta span{font-size:10px;color:#9D9284;display:block;margin-top:1px;}
  .es-ft{margin-top:18px;border-top:1px solid rgba(60,40,20,.12);padding-top:14px;}
  .es-ft-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;font:inherit;padding:4px 0;color:#2A2016;}
  .es-ft-l{display:flex;align-items:center;gap:9px;} .es-ft-ic{width:28px;height:28px;border-radius:8px;background:rgba(255,107,74,.1);color:#E0552F;display:flex;align-items:center;justify-content:center;font-size:15px;flex:none;}
  .es-ft-tt{font-size:13.5px;font-weight:700;text-align:left;} .es-ft-tt small{display:block;font-size:11px;font-weight:500;color:#9D9284;margin-top:1px;}
  .es-chev{color:#9D9284;transition:transform .2s;font-size:13px;} .es-ft.open .es-chev{transform:rotate(90deg);}
  .es-ft-body{margin-top:14px;}
  .es-ptabs{display:flex;gap:2px;border:1px solid rgba(60,40,20,.12);border-radius:10px;padding:3px;overflow-x:auto;margin-bottom:14px;background:#FBF8F4;}
  .es-ptab{font:inherit;font-size:11.5px;font-weight:600;padding:7px 10px;border:none;background:none;color:#9D9284;cursor:pointer;white-space:nowrap;border-radius:7px;}
  .es-ptab.on{background:#fff;color:#2A2016;box-shadow:0 1px 3px rgba(40,26,20,.1);}
  .es-ctl{margin-bottom:14px;} .es-lbl{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9D9284;margin:0 0 7px;}
  .es-row{display:flex;flex-wrap:wrap;gap:6px;}
  .es-chip{font:inherit;font-size:11.5px;font-weight:600;padding:6px 10px;border-radius:8px;border:1px solid rgba(60,40,20,.12);background:#FBF8F4;color:#6E6355;cursor:pointer;transition:all .12s;}
  .es-chip:hover{border-color:#FF6B4A;color:#2A2016;} .es-chip.on{background:#2A2016;color:#fff;border-color:#2A2016;} .es-chip:disabled{opacity:.6;cursor:default;}
  .es-swrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .es-sw{width:23px;height:23px;border-radius:6px;border:1.5px solid rgba(60,40,20,.12);cursor:pointer;padding:0;transition:transform .12s;} .es-sw:hover{transform:scale(1.14);} .es-sw.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #FF6B4A;}
  .es-cust{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#9D9284;} .es-cust input{width:23px;height:23px;border:1px solid rgba(60,40,20,.12);border-radius:6px;background:none;cursor:pointer;padding:2px;}
  .es-palrow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;} .es-pal{cursor:pointer;border:1px solid rgba(60,40,20,.12);border-radius:8px;overflow:hidden;height:28px;display:flex;padding:0;} .es-pal i{flex:1;}
  .es-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px;} .es-toggle span{font-size:12.5px;color:#2A2016;font-weight:500;}
  .es-tg{width:38px;height:22px;border-radius:999px;border:none;background:rgba(60,40,20,.14);position:relative;cursor:pointer;transition:background .15s;flex:none;} .es-tg i{position:absolute;top:2.5px;left:2.5px;width:17px;height:17px;border-radius:50%;background:#fff;transition:left .16s;box-shadow:0 1px 3px rgba(0,0,0,.25);} .es-tg.on{background:#FF6B4A;} .es-tg.on i{left:18.5px;}
  .es-save{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;}
  .es-saved{font-size:12px;font-weight:700;color:#16a34a;}
  .es-save2{font-size:13px;font-weight:700;color:#fff;border:none;border-radius:9px;padding:10px 18px;cursor:pointer;background:linear-gradient(180deg,#FF7A5C,#E2452A);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 14px -5px rgba(255,107,74,.5);transition:filter .15s,transform .12s;}
  .es-save2:hover:not(:disabled){filter:brightness(1.04);transform:translateY(-1px);} .es-save2:disabled{background:rgba(0,0,0,.08);color:#9ca3af;cursor:default;box-shadow:none;}
  .es-err{margin:10px 0 0;font-size:12px;color:#dc2626;}
  .es-right{display:flex;flex-direction:column;background:#E9E5DF;}
  .es-pv-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px 0;flex-wrap:wrap;}
  .es-pv-cap{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9D9284;}
  .es-tabs{display:flex;gap:4px;flex-wrap:wrap;}
  .es-tab{font:inherit;font-size:11px;font-weight:600;padding:5px 10px;border-radius:999px;border:1px solid rgba(60,40,20,.12);background:#fff;color:#6E6355;cursor:pointer;} .es-tab.on{background:#2A2016;color:#fff;border-color:#2A2016;}
  .es-stage{padding:18px;display:flex;justify-content:center;align-items:flex-start;flex:1;transition:background .2s;}
  .es-cap{margin:0;padding:0 18px 14px;font-size:12px;color:#9ca3af;background:#E9E5DF;}
`;
