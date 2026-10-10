"use client";

// Email Studio (2026-10) — the advanced client-email designer. Two steps: pick a
// look from a style family, then shape every detail with direct controls (sliders,
// a draggable gradient, a type ramp, grid colour pickers + eyedropper, visual
// option cards). Click anything in the live preview to jump to its controls. The
// preview renders through the SAME resolver the send path uses
// (lib/email/email-theme-studio.ts), so it can't drift. Saves the expanded theme
// (incl. numeric slider overrides) through the existing logo/theme endpoint — its
// PATCH already sanitises + stores the whole EmailThemeInput blob. The component is
// identity-agnostic: the three mount sites pass their own endpoint + identityName.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmailThemeInput, LogoMode } from "@/lib/email/brand-theme";
import { resolveStudioTheme, tint, luminance, FONT_STACKS, LOOKS, LOOKS_BY_KEY, LOOK_CATEGORIES, type StudioTheme, type LookCategory } from "@/lib/email/email-theme-studio";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import type { BrandingInitial } from "@/components/account/v2/EmailBrandingStudio";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const ALLOWED = new Set(ACCEPT.split(","));
const HEX = /^#[0-9a-fA-F]{6}$/;

// Quick-start palettes — one tap sets header + accent + card + page together.
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

// Photo-banner scenes (CSS gradients standing in for the property photography the
// real send uses). Index stored as theme.bannerScene; overlay darkens for legible
// headline text.
const SCENES = [
  "linear-gradient(120deg,#2b4a6b,#8aa0b5 60%,#c9b79c)",
  "linear-gradient(120deg,#3a5a40,#7a9b6e 55%,#c8d6a8)",
  "linear-gradient(120deg,#4a4e69,#9a8c98 55%,#c9ada7)",
  "linear-gradient(120deg,#6b4423,#b08968 55%,#e6ccb2)",
];
function bannerBg(st: StudioTheme): string {
  const ov = (st.bannerOverlay || 0) / 100;
  return `linear-gradient(rgba(0,0,0,${ov}),rgba(0,0,0,${ov})),${SCENES[st.bannerScene] || SCENES[0]}`;
}

const PREVIEW = {
  milestone: { eye: "Milestone update", hl: "Your mortgage valuation is booked", lead: "Good news on your purchase.", p1: "Your lender has arranged a valuation of the property and will attend next week.", p2: "If you haven't booked your own survey yet, now is a good time. We'll let you know as soon as the offer follows.", cta: "View your portal" },
  invite: { eye: "You're invited", hl: "Track your sale, every step of the way", lead: "Welcome.", p1: "Your own private portal shows exactly where your sale is up to, what happens next, and who to contact.", p2: "Tap below to open your portal. No password needed, the link is yours.", cta: "Open your portal" },
  completion: { eye: "Completion confirmed", hl: "It's done. The keys are yours", lead: "Congratulations.", p1: "Completion has gone through, the funds have transferred and ownership has passed to you.", p2: "Keep your completion statement safe. We'll confirm Land Registry registration once it's processed.", cta: "View completion" },
};
type PreviewKey = keyof typeof PREVIEW;
type EditRegion = "header" | "type" | "button" | "finish";
type FtTab = "type" | "colour" | "header" | "layout" | "button" | "finish";

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
}
function contrast(hexColor: string): string { return luminance(hexColor) > 0.52 ? "#1a1a1a" : "#ffffff"; }
function dividerCss(st: StudioTheme, rule: string): string {
  if (st.dividerStyle === "none") return "";
  if (st.dividerStyle === "hairline") return `1px solid ${rule}`;
  if (st.dividerStyle === "thick") return `2px solid ${st.accent}`;
  return `1px dashed ${rule}`;
}
function bodyInk(cardBg: string) {
  const dark = luminance(cardBg) < 0.4;
  return dark
    ? { main: "#F3F0EB", soft: "rgba(243,240,235,.82)", mut: "rgba(243,240,235,.55)", rule: "rgba(255,255,255,.13)" }
    : { main: "#1a1a1a", soft: "#33302b", mut: "#9a948a", rule: "rgba(20,16,10,.1)" };
}
function initials(name: string): string { const w = name.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x)); return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "A"; }
function detectLook(theme: EmailThemeInput): string {
  const json = JSON.stringify(theme);
  for (const l of LOOKS) if (JSON.stringify(l.theme) === json) return l.key;
  return Object.keys(theme).length === 0 ? "coral" : "custom";
}
function thumbPhoto(hexColor: string): string {
  return `linear-gradient(135deg,${tint(hexColor, 0.85)},${tint(hexColor, 0.5)}),radial-gradient(circle at 70% 20%,rgba(255,255,255,.35),transparent 50%),linear-gradient(180deg,#8aa0b5,#566d82)`;
}

export function EmailStudio({ initial, endpoint = "/api/agent/agency-logo", identityName = "Your agency", themeOnly = false }: { initial: BrandingInitial; endpoint?: string; identityName?: string; themeOnly?: boolean }) {
  // logo (uploaded) — stored on the agency/business logo fields via the endpoint
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [tileColor, setTileColor] = useState(initial.tileColor ?? "#ffffff");
  const [scale, setScale] = useState<LogoScale>(initial.scale ?? "md");
  const [align, setAlign] = useState<LogoAlign>(initial.align ?? "left");
  // theme (stored shape; sliders write numeric overrides into it)
  const [theme, setTheme] = useState<EmailThemeInput>(initial.theme ?? {});
  const [lookKey, setLookKey] = useState<string>(detectLook(initial.theme ?? {}));
  // ui
  const [cat, setCat] = useState<LookCategory | "all">("all");
  const [step, setStep] = useState<1 | 2>(1);
  const [ftTab, setFtTab] = useState<FtTab>("type");
  const [pv, setPv] = useState<PreviewKey>("milestone");
  const [busy, setBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gradRef = useRef<HTMLDivElement>(null);
  const dragStop = useRef<1 | 2 | null>(null);
  // Looks carousel edge-fade (mobile/tablet): no fade at the starting edge, a fade
  // on the far side until you reach the end.
  const looksRef = useRef<HTMLDivElement>(null);
  const [looksFade, setLooksFade] = useState({ l: false, r: false });

  const themeJson = JSON.stringify(theme);
  const [savedJson, setSavedJson] = useState(themeJson);
  const [savedLogo, setSavedLogo] = useState({ tileColor: initial.tileColor ?? "#ffffff", scale: initial.scale ?? ("md" as LogoScale), align: initial.align ?? ("left" as LogoAlign) });
  const dirty = themeJson !== savedJson || tileColor !== savedLogo.tileColor || scale !== savedLogo.scale || align !== savedLogo.align;

  const st = useMemo(() => resolveStudioTheme(theme), [theme]);
  const shownLogo = localPreview ?? logoUrl;
  // Logo-aware brand mark: show the uploaded logo by default, unless the theme
  // explicitly chose wordmark/monogram. Keeps preview == test == real send.
  const effLogoMode: LogoMode = (theme.logoMode as LogoMode | undefined) ?? (shownLogo ? "logo" : "monogram");
  const previewSt = useMemo(() => ({ ...st, logoMode: effLogoMode }), [st, effLogoMode]);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function patch(p: Partial<EmailThemeInput>) { setTheme((t) => ({ ...t, ...p })); setLookKey("custom"); setSavingState("idle"); }
  function applyLook(key: string) { const l = LOOKS_BY_KEY[key]; if (!l) return; setTheme({ ...l.theme }); setLookKey(key); setSavingState("idle"); }
  function jumpTo(region: EditRegion) { setStep(2); setFtTab(region); }

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
      patch({ logoMode: "logo" }); // uploading a logo switches the brand mark to it
    } catch { setError("Upload failed. Try again."); setLocalPreview(null); } finally { setBusy(false); }
  }
  async function onSendTest() {
    if (sendState === "sending") return;
    setSendState("sending"); setError(null);
    try {
      const res = await fetch("/api/agent/email-studio/test", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme, pv, identityName, logoMode: effLogoMode, tileColor, logoUrl: shownLogo && /^https?:\/\//.test(shownLogo) ? shownLogo : undefined }),
      });
      if (!res.ok) { setSendState("error"); return; }
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 4000);
    } catch { setSendState("error"); }
  }
  async function onSave() {
    setSavingState("saving"); setError(null);
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(themeOnly ? { theme } : { tileColor, scale, align, theme }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't save your changes."); setSavingState("idle"); return; }
      setSavedJson(themeJson); setSavedLogo({ tileColor, scale, align }); setSavingState("saved");
    } catch { setError("Couldn't save your changes."); setSavingState("idle"); }
  }

  // gradient-stop drag
  function onGradPointerDown(stop: 1 | 2) { return (e: React.PointerEvent) => { dragStop.current = stop; gradRef.current?.setPointerCapture?.(e.pointerId); e.preventDefault(); }; }
  function onGradPointerMove(e: React.PointerEvent) {
    if (!dragStop.current || !gradRef.current) return;
    const r = gradRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 100)));
    patch(dragStop.current === 1 ? { gradStop1: p } : { gradStop2: p });
  }
  function onGradPointerUp() { dragStop.current = null; }

  // click the preview to jump to the matching controls
  function onStageClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest("[data-edit]") as HTMLElement | null;
    if (el?.dataset.edit) jumpTo(el.dataset.edit as EditRegion);
  }

  const looks = LOOKS.filter((l) => cat === "all" || l.cat === cat);
  const gradientMode = st.headerStyle === "gradient" || st.headerStyle === "duotone";
  const showBanner = st.headerStyle === "banner" || st.heroPhoto;

  const updateLooksFade = useCallback(() => {
    const el = looksRef.current;
    if (!el) return;
    const scrollable = el.scrollWidth - el.clientWidth > 4;
    setLooksFade({
      l: scrollable && el.scrollLeft > 2,
      r: scrollable && el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    if (step !== 1) return;
    updateLooksFade();
    window.addEventListener("resize", updateLooksFade);
    return () => window.removeEventListener("resize", updateLooksFade);
  }, [step, cat, updateLooksFade]);

  return (
    <div className="es">
      <div className="es-frame">
        {/* ── left: controls ── */}
        <div className="es-left">
          <div className="es-pips">
            {[1, 2].map((n) => (
              <button key={n} type="button" className={`es-pip${step === n ? " on" : n < step ? " done" : ""}`} onClick={() => setStep(n as 1 | 2)}>
                <span className="es-pip-n">{n}</span>
                <span className="es-pip-tx">{n === 1 ? "Choose a look" : "Customise"}<span>{n === 1 ? "Start from a style" : "Shape every detail"}</span></span>
              </button>
            ))}
          </div>

          <div className="es-body">
            {step === 1 ? (
              <div className="es-pane">
                <div className="es-cats">
                  {LOOK_CATEGORIES.map((c) => (
                    <button key={c.key} type="button" className={`es-cat${c.key === cat ? " on" : ""}`} onClick={() => setCat(c.key as LookCategory | "all")}>{c.label}</button>
                  ))}
                </div>
                <div className={`es-looks-wrap${looksFade.l ? " fl" : ""}${looksFade.r ? " fr" : ""}`}>
                  <div className="es-looks" ref={looksRef} onScroll={updateLooksFade}>
                    {looks.map((l) => (
                      <button key={l.key} type="button" className={`es-look${l.key === lookKey ? " on" : ""}`} onClick={() => applyLook(l.key)}>
                        <Thumb theme={l.theme} />
                        <span className="es-lk-meta"><b>{l.label}</b><span>{l.tag}</span></span>
                      </button>
                    ))}
                  </div>
                  <div className="es-looks-fade l" aria-hidden="true" />
                  <div className="es-looks-fade r" aria-hidden="true" />
                </div>
              </div>
            ) : (
              <div className="es-pane es-back">
                <div className="es-fttabs">
                  {(["type", "colour", "header", "layout", "button", "finish"] as FtTab[]).map((t) => (
                    <button key={t} type="button" className={`es-fttab${ftTab === t ? " on" : ""}`} onClick={() => setFtTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>

                {ftTab === "type" && (
                  <>
                    <Grp label="Heading typeface">
                      <select className="es-fontsel" value={theme.typeSystem ?? "humanist"} onChange={(e) => patch({ typeSystem: e.target.value as EmailThemeInput["typeSystem"] })}>
                        {(Object.keys(FONT_STACKS) as Array<keyof typeof FONT_STACKS>).map((k) => <option key={k} value={k}>{FONT_STACKS[k].label}</option>)}
                      </select>
                    </Grp>
                    <Grp label="Type scale">
                      <div className="es-ramp">
                        <div className="es-r1" style={{ fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: st.headingWeightNum }}>Your valuation is booked</div>
                        <div className="es-r3">What next</div>
                        <div className="es-rb" style={{ fontFamily: st.bodyFont }}>We&apos;ll let you know as soon as the offer follows.</div>
                      </div>
                      <Slider label="Headline" min={20} max={46} step={1} value={st.headingSizePx} suffix="px" onChange={(v) => patch({ headlinePx: v })} />
                      <Slider label="Weight" min={300} max={900} step={100} value={st.headingWeightNum} suffix="" onChange={(v) => patch({ headingWeightNum: v })} />
                    </Grp>
                    <Grp label="Spacing">
                      <Slider label="Line height" min={1.2} max={2} step={0.02} value={Number(st.leadingCss)} suffix="x" onChange={(v) => patch({ lineHeight: v })} />
                      <Slider label="Letter space" min={-0.04} max={0.1} step={0.005} value={parseFloat(st.trackingCss)} suffix="em" onChange={(v) => patch({ trackingEm: v })} />
                    </Grp>
                    <Grp label="Alignment">
                      <Seg value={st.align} opts={[["left", "Left"], ["center", "Centre"]]} onChange={(v) => patch({ align: v as EmailThemeInput["align"] })} />
                    </Grp>
                  </>
                )}

                {ftTab === "colour" && (
                  <>
                    <Grp label="Palettes">
                      <div className="es-pals">
                        {PALETTES.map((p, i) => (
                          <button key={i} type="button" className="es-pal" onClick={() => patch({ headerColor: p.headerColor, headerColor2: p.headerColor2, accentColor: p.accentColor, cardBg: p.cardBg, pageBg: p.pageBg })}>
                            <span className="es-pal-sw"><i style={{ background: p.headerColor }} /><i style={{ background: p.accentColor }} /><i style={{ background: p.cardBg }} /></span>
                            <span className="es-pal-nm">{p.n}</span>
                          </button>
                        ))}
                      </div>
                    </Grp>
                    {gradientMode && (
                      <Grp label="Header gradient">
                        <div className="es-gbar" ref={gradRef} style={{ background: st.headerBg }} onPointerMove={onGradPointerMove} onPointerUp={onGradPointerUp}>
                          <span className="es-gstop" style={{ left: `${st.gradStop1}%`, background: st.c1 }} onPointerDown={onGradPointerDown(1)} />
                          {st.c2 && <span className="es-gstop" style={{ left: `${st.gradStop2}%`, background: st.c2 }} onPointerDown={onGradPointerDown(2)} />}
                        </div>
                        <div className="es-grow">
                          <input type="color" value={HEX.test(theme.headerColor ?? st.c1) ? (theme.headerColor ?? st.c1) : "#ffffff"} onChange={(e) => patch({ headerColor: e.target.value })} />
                          <input type="color" value={HEX.test(theme.headerColor2 ?? st.c2 ?? "#ffffff") ? (theme.headerColor2 ?? st.c2 ?? "#ffffff") : "#ffffff"} onChange={(e) => patch({ headerColor2: e.target.value })} />
                          <Slider label="Angle" min={0} max={360} step={1} value={st.gradAngle} suffix="°" onChange={(v) => patch({ gradAngle: v })} compact />
                        </div>
                      </Grp>
                    )}
                    <Grp label="Colours">
                      <div className="es-cgrid">
                        {!gradientMode && <ColourCell label="Header" value={theme.headerColor ?? st.c1} onChange={(v) => patch({ headerColor: v })} />}
                        <ColourCell label="Accent" value={theme.accentColor ?? st.accent} onChange={(v) => patch({ accentColor: v })} />
                        <ColourCell label="Card background" value={theme.cardBg ?? st.cardBg} onChange={(v) => patch({ cardBg: v })} />
                        <ColourCell label="Page background" value={theme.pageBg ?? st.pageBg} onChange={(v) => patch({ pageBg: v })} />
                      </div>
                    </Grp>
                  </>
                )}

                {ftTab === "header" && (
                  <>
                    <VisualCards value={st.headerStyle} cols={3} onChange={(v) => patch({ headerStyle: v as EmailThemeInput["headerStyle"] })} opts={[
                      { v: "gradient", l: "Gradient", vis: <HVis h="gradient" /> }, { v: "solid", l: "Solid", vis: <HVis h="solid" /> }, { v: "duotone", l: "Duotone", vis: <HVis h="duotone" /> },
                      { v: "minimal", l: "Minimal", vis: <HVis h="minimal" /> }, { v: "logoband", l: "Logo band", vis: <HVis h="logoband" /> }, { v: "banner", l: "Photo", vis: <HVis h="banner" /> },
                      { v: "centered", l: "Centered", vis: <HVis h="centered" /> }, { v: "none", l: "None", vis: <HVis h="none" /> },
                    ]} />
                    <Grp label="Brand mark">
                      <Seg value={themeOnly && effLogoMode === "logo" ? "wordmark" : effLogoMode} opts={themeOnly ? [["monogram", "Monogram"], ["wordmark", "Wordmark"]] : [["monogram", "Monogram"], ["wordmark", "Wordmark"], ["logo", "Logo"]]} onChange={(v) => patch({ logoMode: v as LogoMode })} />
                      {themeOnly ? (
                        <p className="es-nudge">Each client&rsquo;s own logo appears on their emails. This house style sets the colours, type and layout they start from.</p>
                      ) : st.logoMode === "logo" ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                            <button type="button" className="es-upload" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}</button>
                            <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} />
                          </div>
                          <div className="es-cgrid"><ColourCell label="Logo background" value={tileColor} onChange={(v) => { setTileColor(v); setSavingState("idle"); }} /></div>
                        </div>
                      ) : (
                        <p className="es-nudge">Using your {st.logoMode === "wordmark" ? "name as a wordmark" : "initials"}. <button type="button" className="es-link" onClick={() => { patch({ logoMode: "logo" }); inputRef.current?.click(); }}>Upload a logo</button> for a more personal header.<input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} /></p>
                      )}
                    </Grp>
                    {showBanner && (
                      <Grp label="Photo banner">
                        <div className="es-vopts es-c4">
                          {SCENES.map((sc, i) => (
                            <button key={i} type="button" className={`es-vopt${st.bannerScene === i ? " on" : ""}`} onClick={() => patch({ bannerScene: i })}>
                              <span className="es-vv" style={{ padding: 0, background: sc }} /><span className="es-vl">Scene {i + 1}</span>
                            </button>
                          ))}
                        </div>
                        <Slider label="Darken" min={0} max={75} step={1} value={st.bannerOverlay} suffix="%" onChange={(v) => patch({ bannerOverlay: v })} />
                      </Grp>
                    )}
                    <Grp label="Options">
                      <Toggle label="Show eyebrow label" on={st.showEyebrow} toggle={() => patch({ showEyebrow: !st.showEyebrow })} />
                      <Toggle label="Property photo banner" on={st.heroPhoto} toggle={() => patch({ heroPhoto: !st.heroPhoto })} />
                    </Grp>
                  </>
                )}

                {ftTab === "layout" && (
                  <>
                    <Grp label="Dimensions">
                      <Slider label="Width" min={380} max={620} step={2} value={st.maxWidthPx} suffix="px" onChange={(v) => patch({ widthPx: v })} />
                      <Slider label="Padding" min={14} max={44} step={1} value={st.contentPadX} suffix="px" onChange={(v) => patch({ padX: v })} />
                    </Grp>
                    <VisualCards value={st.sectionStyle} cols={2} onChange={(v) => patch({ sectionStyle: v as EmailThemeInput["sectionStyle"] })} opts={[
                      { v: "plain", l: "Flowing", vis: <SVis v="plain" /> }, { v: "cards", l: "Cards", vis: <SVis v="cards" /> },
                    ]} />
                    <Grp label="Dividers">
                      <VisualCards value={st.dividerStyle} cols={4} onChange={(v) => patch({ dividerStyle: v as EmailThemeInput["dividerStyle"] })} bare opts={[
                        { v: "none", l: "None", vis: <DVis v="none" /> }, { v: "hairline", l: "Hairline", vis: <DVis v="hairline" /> }, { v: "thick", l: "Bold", vis: <DVis v="thick" /> }, { v: "dotted", l: "Dotted", vis: <DVis v="dotted" /> },
                      ]} />
                    </Grp>
                  </>
                )}

                {ftTab === "button" && (
                  <>
                    <VisualCards value={st.buttonFill} cols={3} onChange={(v) => patch({ buttonFill: v as EmailThemeInput["buttonFill"] })} opts={[
                      { v: "filled", l: "Filled", vis: <BVis v="filled" st={st} /> }, { v: "soft", l: "Soft", vis: <BVis v="soft" st={st} /> }, { v: "outline", l: "Outline", vis: <BVis v="outline" st={st} /> },
                    ]} />
                    <Grp label="Shape & size">
                      <Slider label="Radius" min={0} max={999} step={1} value={st.buttonRadiusPx} suffix="px" onChange={(v) => patch({ buttonRadiusPx: v })} />
                      <Slider label="Height" min={8} max={22} step={1} value={parseInt(st.buttonPadCss)} suffix="px" onChange={(v) => patch({ buttonPadY: v })} />
                      <Slider label="Width" min={14} max={48} step={1} value={parseInt(st.buttonPadCss.split(" ")[1] ?? "26")} suffix="px" onChange={(v) => patch({ buttonPadX: v })} />
                      <Slider label="Text" min={12} max={18} step={0.5} value={st.buttonFontPx} suffix="px" onChange={(v) => patch({ buttonFontPx: v })} />
                    </Grp>
                    <Grp label="Options">
                      <Toggle label="Full-width button" on={st.buttonFullWidth} toggle={() => patch({ buttonFullWidth: !st.buttonFullWidth })} />
                      <Toggle label="Button shadow" on={st.buttonShadow} toggle={() => patch({ buttonShadow: !st.buttonShadow })} />
                      <Toggle label="Arrow on button" on={st.buttonArrow} toggle={() => patch({ buttonArrow: !st.buttonArrow })} />
                    </Grp>
                  </>
                )}

                {ftTab === "finish" && (
                  <>
                    <Grp label="Shape">
                      <Slider label="Corners" min={0} max={28} step={1} value={st.cardRadiusPx} suffix="px" onChange={(v) => patch({ cardRadiusPx: v })} />
                      <Slider label="Shadow" min={0} max={100} step={1} value={theme.shadowAmt ?? (st.cardShadow === "none" ? 0 : st.cardShadow === "strong" ? 70 : 35)} suffix="" onChange={(v) => patch({ shadowAmt: v })} />
                    </Grp>
                    <VisualCards value={st.footerStyle} cols={3} onChange={(v) => patch({ footerStyle: v as EmailThemeInput["footerStyle"] })} opts={[
                      { v: "none", l: "None", vis: <FVis v="none" /> }, { v: "simple", l: "Simple", vis: <FVis v="simple" /> }, { v: "band", l: "Coloured", vis: <FVis v="band" st={st} /> },
                    ]} />
                    <Grp label=""><Toggle label="Card border" on={st.cardBorder} toggle={() => patch({ cardBorder: !st.cardBorder })} /></Grp>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="es-foot">
            {step === 2 ? <button type="button" className="es-backbtn" onClick={() => setStep(1)}>← Back to looks</button> : <span />}
            <div className="es-fr">
              {!dirty && savingState === "saved" && <span className="es-saved">Saved</span>}
              {step === 1 && <button type="button" className="es-btn" onClick={() => setStep(2)}>Next: Customise <span className="es-arr">→</span></button>}
              <button type="button" className="es-btn" onClick={onSave} disabled={!dirty || savingState === "saving"}>{savingState === "saving" ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
          {error && <p className="es-err" role="alert">{error}</p>}
        </div>

        {/* ── right: preview ── */}
        <div className="es-right">
          <div className="es-pv-top">
            <div className="es-pv-caprow"><span className="es-pv-cap">Live preview</span> <span className="es-pv-hint">click any part to edit</span></div>
            <div className="es-pv-row">
              <div className="es-tabs">{(Object.keys(PREVIEW) as PreviewKey[]).map((k) => (
                <button key={k} type="button" className={`es-tab${pv === k ? " on" : ""}`} onClick={() => setPv(k)}>{k === "milestone" ? "Milestone" : k === "invite" ? "Invite" : "Completion"}</button>
              ))}</div>
              <button type="button" className="es-btn es-send" onClick={onSendTest} disabled={sendState === "sending"}>
                {sendState === "sending" ? "Sending…" : sendState === "sent" ? "Sent ✓" : sendState === "error" ? "Try again" : <>Send test <span className="es-arr">→</span></>}
              </button>
            </div>
          </div>
          <div className="es-stage" style={{ background: st.pageBg }} onClick={onStageClick}>
            <PreviewEmail st={previewSt} pv={pv} identityName={identityName} logo={shownLogo} tileColor={tileColor} scale={scale} align={align} busy={busy} />
          </div>
          <p className="es-cap">Preview exactly what your buyers and sellers receive.</p>
        </div>
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

// ── brand mark: uploaded logo on a tile / wordmark / refined monogram ──
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

// ── preview email ──
function PreviewEmail({ st, pv, identityName, logo, tileColor, busy }: { st: StudioTheme; pv: PreviewKey; identityName: string; logo: string | null; tileColor: string; scale: LogoScale; align: LogoAlign; busy: boolean }) {
  const c = PREVIEW[pv];
  const T = bodyInk(st.cardBg);
  const px = st.contentPadX;
  const alignCss = st.align as "left" | "center";
  const mark = (sz: number, bg: string, fg: string) => <BrandMark st={st} sz={sz} bg={bg} fg={fg} identityName={identityName} logo={logo} tileColor={tileColor} />;
  return (
    <div style={{ width: "100%", maxWidth: st.maxWidthPx, background: st.cardBg, borderRadius: st.cardRadiusPx, overflow: "hidden", boxShadow: st.cardShadowCss, border: st.cardBorder ? `1px solid ${T.rule}` : "none", transition: "all .2s", opacity: busy ? 0.75 : 1 }}>
      <div className="es-edit" data-edit="header" data-tip="Header"><Header st={st} c={c} T={T} mark={mark} identityName={identityName} /></div>
      {st.heroPhoto && st.headerStyle !== "banner" && <div className="es-edit" data-edit="header" data-tip="Photo" style={{ height: 140, background: bannerBg(st) }} />}
      <div className="es-edit" data-edit="type" data-tip="Text" style={{ padding: `${px}px ${px}px 4px`, textAlign: alignCss }}>
        <p style={{ margin: "0 0 15px", fontSize: 14.5, lineHeight: st.leadingCss, color: T.main, fontFamily: st.bodyFont }}>Hi Daniel,</p>
        <Block st={st} p={c.p1} T={T} first />
        <Block st={st} p={c.p2} T={T} />
      </div>
      <div className="es-edit" data-edit="button" data-tip="Button" style={{ padding: `8px ${px}px ${px}px`, textAlign: alignCss }}><Button st={st} label={c.cta} /></div>
      <div className="es-edit" data-edit="finish" data-tip="Footer"><Footer st={st} T={T} identityName={identityName} /></div>
    </div>
  );
}

function Header({ st, c, T, mark, identityName: identityNameFromMark }: { st: StudioTheme; c: typeof PREVIEW[PreviewKey]; T: ReturnType<typeof bodyInk>; mark: (sz: number, bg: string, fg: string) => React.ReactNode; identityName: string }) {
  const px = st.contentPadX;
  const eyebrow = (col: string) => st.showEyebrow ? <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: st.trackingCss === "0em" || st.trackingCss === "0" ? "0.12em" : st.trackingCss, textTransform: "uppercase", color: col }}>{c.eye}</p> : null;
  const hl = (col: string) => <h1 style={{ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: st.headingWeightNum, letterSpacing: st.trackingCss, color: col, lineHeight: 1.16 }}>{c.hl}</h1>;

  if (st.headerStyle === "none") return <div style={{ padding: `${px}px ${px}px 0`, textAlign: st.align }}>{mark(40, tint(st.accent, 0.12), st.accent)}</div>;
  if (st.headerStyle === "minimal") return (
    <div style={{ padding: `${px}px ${px}px 20px`, borderBottom: `3px solid ${st.accent}`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 14 }}>{mark(40, tint(st.accent, 0.14), st.accent)}</div>{eyebrow(st.accent)}{hl(T.main)}
    </div>
  );
  if (st.headerStyle === "logoband") {
    const bandBg = luminance(st.cardBg) < 0.4 ? tint(st.accent, 0.16) : (luminance(st.c1) > 0.6 ? tint(st.c1, 0.2) : "#ffffff");
    return (<>
      <div style={{ background: bandBg, padding: `13px ${px}px`, display: "flex", alignItems: "center", gap: 10, borderBottom: `3px solid ${st.accent}` }}>{mark(28, st.headerBg, contrast(st.c1))}{st.logoMode !== "wordmark" && <span style={{ fontFamily: st.headingFont, fontWeight: 800, fontSize: 15, color: T.main }}>{identityNameFromMark}</span>}</div>
      <div style={{ padding: `20px ${px}px 0`, textAlign: st.align }}>{eyebrow(st.accent)}{hl(T.main)}</div>
    </>);
  }
  if (st.headerStyle === "banner") return (
    <div style={{ background: bannerBg(st), padding: `${px + 16}px ${px}px`, textAlign: st.align }}>
      <div style={{ display: "inline-block", marginBottom: 12 }}>{mark(40, tint("#ffffff", 0.2), "#fff")}</div>{eyebrow("#fff")}
      <h1 style={{ margin: 0, fontFamily: st.headingFont, fontSize: st.headingSizePx, fontWeight: st.headingWeightNum, letterSpacing: st.trackingCss, color: "#fff", textShadow: "0 1px 10px rgba(0,0,0,.4)", lineHeight: 1.16 }}>{c.hl}</h1>
      <p style={{ margin: "9px 0 0", fontSize: 14, color: "#fff" }}>{c.lead}</p>
    </div>
  );
  const tx = contrast(st.c1), cen = st.headerStyle === "centered" ? "center" : st.align;
  const bg = st.headerStyle === "duotone" ? `linear-gradient(${st.gradAngle}deg,${st.c1} 0%,${st.c1} 55%,${st.accent} 100%)` : st.headerBg;
  return (
    <div style={{ background: bg, padding: `${px + 2}px ${px}px`, textAlign: cen }}>
      <div style={{ display: cen === "center" ? "inline-block" : "block", marginBottom: 14 }}>{mark(40, tint(tx === "#ffffff" ? "#ffffff" : "#000000", 0.16), tx)}</div>{eyebrow(tx)}{hl(tx)}
      <p style={{ margin: "9px 0 0", fontSize: 14, color: tx, opacity: 0.92 }}>{c.lead}</p>
    </div>
  );
}

function Block({ st, p, T, first }: { st: StudioTheme; p: string; T: ReturnType<typeof bodyInk>; first?: boolean }) {
  const card = st.sectionStyle === "cards";
  const style: React.CSSProperties = card
    ? { border: `1px solid ${T.rule}`, borderRadius: st.cardRadiusPx === 0 ? 0 : 10, padding: "14px 16px", marginBottom: 12 }
    : { marginBottom: 14, ...(first ? {} : { paddingTop: 14, marginTop: 2, borderTop: dividerCss(st, T.rule) || undefined }) };
  return <p style={{ margin: 0, ...style, fontSize: 14.5, lineHeight: st.leadingCss, color: T.soft, fontFamily: st.bodyFont }}>{p}</p>;
}

function Button({ st, label }: { st: StudioTheme; label: string }) {
  const fill = st.buttonFill === "outline"
    ? { background: "transparent", color: st.accent, border: `1.6px solid ${st.accent}` }
    : st.buttonFill === "soft"
      ? { background: tint(st.accent, 0.14), color: st.accent, border: "1.6px solid transparent" }
      : { background: st.accent, color: contrast(st.accent), border: `1.6px solid ${st.accent}` };
  return <a href="#" onClick={(e) => e.preventDefault()} style={{ display: st.buttonFullWidth ? "block" : "inline-block", width: st.buttonFullWidth ? "100%" : undefined, borderRadius: st.buttonRadiusPx, padding: st.buttonPadCss, fontSize: st.buttonFontPx, fontWeight: 700, fontFamily: st.headingFont, textAlign: "center", textDecoration: "none", boxShadow: st.buttonShadow ? `0 8px 20px ${tint(st.accent, 0.4)}` : undefined, ...fill }}>{label}{st.buttonArrow ? " →" : ""}</a>;
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
  const bg = st.headerStyle === "banner" ? thumbPhoto(st.c1) : light ? st.cardBg : st.headerBg;
  const tc = st.headerStyle === "banner" ? "#fff" : light ? T.main : contrast(st.c1);
  const ec = st.headerStyle === "banner" ? "#fff" : light ? st.accent : contrast(st.c1);
  const bstyle: React.CSSProperties = st.buttonFill === "outline" ? { background: "transparent", color: st.accent, border: `1px solid ${st.accent}` } : st.buttonFill === "soft" ? { background: tint(st.accent, 0.14), color: st.accent } : { background: st.accent, color: contrast(st.accent) };
  return (
    <div style={{ background: st.cardBg, borderRadius: st.cardRadiusPx === 0 ? 0 : 6, overflow: "hidden", boxShadow: "0 2px 8px rgba(20,14,8,.16)" }}>
      <div style={{ background: bg, padding: "9px 10px 8px", borderBottom: light ? `2px solid ${st.accent}` : "none" }}>
        {st.showEyebrow && <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ec, marginBottom: 2 }}>{c.eye}</div>}
        <div style={{ fontSize: 9.5, fontWeight: 800, lineHeight: 1.1, color: tc, fontFamily: st.headingFont }}>{c.hl}</div>
      </div>
      <div style={{ padding: "7px 10px 9px" }}>
        <div style={{ height: 3, background: T.rule, borderRadius: 2, marginBottom: 3, width: "85%" }} />
        <div style={{ height: 3, background: T.rule, borderRadius: 2, marginBottom: 7, width: "60%" }} />
        <span style={{ display: "inline-block", fontSize: 6, fontWeight: 700, padding: "3px 8px", borderRadius: Math.min(st.buttonRadiusPx, 20), ...bstyle }}>{c.cta}</span>
      </div>
    </div>
  );
}

// ── control primitives ──
function Grp({ label, children }: { label: string; children: React.ReactNode }) { return <div className="es-grp">{label ? <p className="es-lbl">{label}</p> : null}{children}</div>; }
function Slider({ label, min, max, step, value, suffix, onChange, compact }: { label: string; min: number; max: number; step: number; value: number; suffix: string; onChange: (v: number) => void; compact?: boolean }) {
  const fmt = suffix === "em" ? `${value.toFixed(2)}em` : suffix === "x" ? value.toFixed(2) : suffix === "" ? String(Math.round(value)) : `${Math.round(value)}${suffix}`;
  return (
    <div className={`es-srow${compact ? " es-sc" : ""}`}>
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="es-val">{fmt}</span>
    </div>
  );
}
function Seg({ value, opts, onChange }: { value: string; opts: Array<[string, string]>; onChange: (v: string) => void }) {
  return <div className="es-seg">{opts.map(([v, l]) => <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
function Toggle({ label, on, toggle }: { label: string; on: boolean; toggle: () => void }) {
  return <div className="es-toggle"><span>{label}</span><button type="button" className={`es-tg${on ? " on" : ""}`} onClick={toggle}><i /></button></div>;
}
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
function ColourCell({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Local text so a half-typed hex isn't snapped back by the controlled value;
  // re-sync when the value changes elsewhere (a look/palette tap).
  const [hexText, setHexText] = useState(value.toUpperCase());
  const focused = useRef(false);
  // Eyedropper gated behind a mount flag so the button doesn't cause a hydration
  // mismatch (window is absent server-side).
  const [canPick, setCanPick] = useState(false);
  useEffect(() => { setCanPick("EyeDropper" in window); }, []);
  useEffect(() => { if (!focused.current) setHexText(value.toUpperCase()); }, [value]);
  const pick = async () => {
    const ED = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!ED) return;
    try { const r = await new ED().open(); if (r?.sRGBHex) onChange(r.sRGBHex); } catch { /* cancelled */ }
  };
  return (
    <div className="es-ccell">
      <span className="es-cs" style={{ background: value }}><input type="color" value={HEX.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} /></span>
      <span className="es-cx">
        <b>{label}</b>
        <input
          type="text" value={hexText} spellCheck={false}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setHexText(value.toUpperCase()); }}
          onChange={(e) => { const v = e.target.value.trim(); setHexText(v); const h = v[0] === "#" ? v : `#${v}`; if (HEX.test(h)) onChange(h); }}
        />
      </span>
      {canPick && <button type="button" className="es-eye" title="Pick a colour from screen" onClick={pick}>◎</button>}
    </div>
  );
}
function VisualCards({ value, cols, opts, onChange, bare }: { value: string; cols: number; opts: Array<{ v: string; l: string; vis: React.ReactNode }>; onChange: (v: string) => void; bare?: boolean }) {
  const grid = <div className={`es-vopts es-c${cols}`}>{opts.map((o) => (
    <button key={o.v} type="button" className={`es-vopt${value === o.v ? " on" : ""}`} onClick={() => onChange(o.v)}><span className="es-vv">{o.vis}</span><span className="es-vl">{o.l}</span></button>
  ))}</div>;
  return bare ? grid : <Grp label="">{grid}</Grp>;
}

// ── mini visuals for the option cards ──
function HVis({ h }: { h: string }) {
  const c1 = "#FF8A65", c2 = "#FFB74D", ac = "#FF6B4A";
  const base: React.CSSProperties = { width: "100%", height: "100%" };
  if (h === "solid") return <span style={{ ...base, background: c1 }} />;
  if (h === "gradient") return <span style={{ ...base, background: `linear-gradient(135deg,${c1},${c2})` }} />;
  if (h === "duotone") return <span style={{ ...base, background: `linear-gradient(135deg,${c1} 55%,${ac})` }} />;
  if (h === "minimal") return <span style={{ ...base, background: "#fff", borderBottom: `3px solid ${ac}` }} />;
  if (h === "logoband") return <span style={{ ...base, background: "#f3efe9", borderBottom: `3px solid ${ac}`, display: "flex", alignItems: "center", paddingLeft: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c1 }} /></span>;
  if (h === "banner") return <span style={{ ...base, background: thumbPhoto(c1) }} />;
  if (h === "centered") return <span style={{ ...base, background: `linear-gradient(135deg,${c1},${c2})`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} /></span>;
  return <span style={{ ...base, background: "#fff" }} />;
}
function SVis({ v }: { v: string }) {
  return v === "cards"
    ? <span style={{ display: "flex", flexDirection: "column", gap: 2, width: "60%" }}><span style={{ height: 6, border: "1px solid #ccc", borderRadius: 2 }} /><span style={{ height: 6, border: "1px solid #ccc", borderRadius: 2 }} /></span>
    : <span style={{ display: "flex", flexDirection: "column", gap: 3, width: "60%" }}><span style={{ height: 2, background: "#ccc" }} /><span style={{ height: 2, background: "#ccc" }} /></span>;
}
function DVis({ v }: { v: string }) {
  if (v === "none") return <span style={{ width: "50%", height: 2, background: "#ddd" }} />;
  if (v === "thick") return <span style={{ width: "50%", height: 3, background: "#FF6B4A" }} />;
  if (v === "dotted") return <span style={{ width: "50%", borderTop: "2px dashed #aaa" }} />;
  return <span style={{ width: "50%", borderTop: "1px solid #999" }} />;
}
function BVis({ v, st }: { v: string; st: StudioTheme }) {
  const ac = st.accent;
  const s: React.CSSProperties = v === "outline" ? { background: "transparent", color: ac, border: `1.5px solid ${ac}` } : v === "soft" ? { background: tint(ac, 0.16), color: ac } : { background: ac, color: contrast(ac) };
  return <span style={{ fontSize: 8, fontWeight: 700, padding: "4px 10px", borderRadius: 6, ...s }}>Button</span>;
}
function FVis({ v, st }: { v: string; st?: StudioTheme }) {
  if (v === "none") return <span style={{ width: "70%", height: 8, background: "#f0ede9", borderRadius: 2 }} />;
  if (v === "band") return <span style={{ width: "70%", height: 8, background: tint(st?.accent ?? "#FF6B4A", 0.2), borderRadius: 2 }} />;
  return <span style={{ width: "70%", borderTop: "1px solid #ccc", paddingTop: 3 }}><span style={{ display: "block", height: 3, width: "50%", background: "#e0ddd8" }} /></span>;
}

const STYLES = `
  .es{--hair:rgba(60,40,20,.12);--hair2:rgba(60,40,20,.06);--ink:#2A2016;--ink2:#6E6355;--ink3:#9D9284;--coral:#FF6B4A;--coral-deep:#E0552F;--coral-tint:rgba(255,107,74,.1);--card2:#FBF8F4;--scroll:rgba(60,40,20,.22);--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .es-frame{display:grid;grid-template-columns:1.18fr 1fr;height:660px;border:1px solid var(--hair);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 2px 4px rgba(40,26,20,.04),0 18px 44px rgba(40,26,20,.07);font-family:var(--sans);}
  @media(max-width:900px){.es-frame{grid-template-columns:1fr;height:auto;}}
  .es-left{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--hair);}
  @media(max-width:900px){.es-left{border-right:none;border-bottom:1px solid var(--hair);}}
  .es-pips{display:flex;gap:6px;padding:14px 18px;border-bottom:1px solid var(--hair2);background:var(--card2);}
  .es-pip{flex:1;display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;padding:3px;text-align:left;opacity:.5;transition:opacity .2s;font:inherit;}
  .es-pip.on,.es-pip.done{opacity:1;}
  .es-pip-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:800;flex:none;color:#9ca3af;background:linear-gradient(180deg,#f4f5f7,#e2e5e9);box-shadow:inset 0 1.5px 1px rgba(255,255,255,.9),inset 0 -2px 4px rgba(0,0,0,.07),0 2px 4px -2px rgba(15,23,42,.18);transition:all .2s;}
  .es-pip.on .es-pip-n,.es-pip.done .es-pip-n{background:linear-gradient(180deg,#FF8A5C,#E2452A);color:#fff;box-shadow:inset 0 1.5px 1px rgba(255,255,255,.45),inset 0 -2px 5px rgba(0,0,0,.18),0 3px 8px -2px rgba(255,107,74,.55);}
  .es-pip-tx{font-size:13px;font-weight:700;color:var(--ink);line-height:1.15;} .es-pip-tx span{display:block;font-size:10.5px;font-weight:500;color:var(--ink3);margin-top:1px;}
  @media(max-width:900px){.es-pip:not(.on){display:none;}}
  .es-body{flex:1;min-height:0;overflow-y:auto;padding:18px 20px;scrollbar-width:thin;scrollbar-color:var(--scroll) transparent;}
  .es-body::-webkit-scrollbar{width:10px;} .es-body::-webkit-scrollbar-track{background:transparent;} .es-body::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:6px;border:3px solid transparent;background-clip:padding-box;}
  .es-pane{animation:esf .24s cubic-bezier(.22,1,.36,1) both;} @keyframes esf{from{opacity:0;transform:translateX(8px);}to{opacity:1;transform:none;}}
  .es-pane.es-back{animation-name:esb;} @keyframes esb{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:none;}}
  .es-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
  .es-cat{font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--hair);background:var(--card2);color:var(--ink2);cursor:pointer;transition:all .13s;}
  .es-cat:hover{border-color:var(--coral);color:var(--ink);} .es-cat.on{background:var(--ink);color:#fff;border-color:var(--ink);}
  .es-looks{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;} @media(min-width:1050px){.es-looks{grid-template-columns:repeat(3,1fr);}}
  .es-looks-wrap{position:relative;}
  .es-looks-fade{position:absolute;top:0;bottom:0;width:44px;pointer-events:none;opacity:0;transition:opacity .2s;z-index:3;}
  .es-looks-fade.l{left:0;background:linear-gradient(to right,#fff,rgba(255,255,255,0));}
  .es-looks-fade.r{right:0;background:linear-gradient(to left,#fff,rgba(255,255,255,0));}
  .es-looks-wrap.fl .es-looks-fade.l{opacity:1;} .es-looks-wrap.fr .es-looks-fade.r{opacity:1;}
  @media(min-width:1025px){.es-looks-fade{display:none;}}
  @media(max-width:1024px){
    .es-looks{grid-template-columns:none;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:46%;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding-bottom:2px;scrollbar-width:none;}
    .es-looks::-webkit-scrollbar{display:none;}
    .es-look{scroll-snap-align:start;}
  }
  .es-look{cursor:pointer;border:1.5px solid var(--hair);border-radius:12px;overflow:hidden;background:var(--card2);padding:7px;transition:transform .14s,border-color .14s,box-shadow .14s;text-align:left;font:inherit;}
  .es-look:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(40,26,20,.12);} .es-look.on{border-color:var(--coral);box-shadow:0 0 0 3px var(--coral-tint);}
  .es-lk-meta{display:block;padding:7px 3px 2px;} .es-lk-meta b{font-size:12px;font-weight:700;display:block;color:var(--ink);} .es-lk-meta span{font-size:10px;color:var(--ink3);display:block;margin-top:1px;}
  .es-fttabs{display:flex;gap:2px;border:1px solid var(--hair);border-radius:10px;padding:3px;overflow-x:auto;margin-bottom:16px;background:var(--card2);}
  .es-fttab{font:inherit;font-size:11.5px;font-weight:600;padding:7px 10px;border:none;background:none;color:var(--ink3);cursor:pointer;white-space:nowrap;border-radius:7px;transition:all .13s;}
  .es-fttab.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(40,26,20,.1);}
  .es-grp{margin-bottom:17px;} .es-grp:last-child{margin-bottom:2px;}
  .es-lbl{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);margin:0 0 9px;}
  .es-srow{display:flex;align-items:center;gap:11px;margin-bottom:12px;} .es-srow:last-child{margin-bottom:0;} .es-srow.es-sc{flex:1;margin:0;}
  .es-srow label{font-size:11.5px;font-weight:600;color:var(--ink2);width:86px;flex:none;} .es-srow.es-sc label{width:auto;}
  .es input[type=range]{flex:1;-webkit-appearance:none;appearance:none;height:5px;border-radius:5px;background:var(--hair);outline:none;margin:0;}
  .es input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:#fff;border:2px solid var(--coral);box-shadow:0 2px 6px rgba(255,107,74,.45);cursor:pointer;}
  .es input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--coral);cursor:pointer;}
  .es-val{font-size:11.5px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;width:56px;text-align:right;flex:none;}
  .es-vopts{display:grid;gap:7px;} .es-c2{grid-template-columns:1fr 1fr;} .es-c3{grid-template-columns:1fr 1fr 1fr;} .es-c4{grid-template-columns:repeat(4,1fr);}
  .es-vopt{border:1.5px solid var(--hair);border-radius:10px;overflow:hidden;cursor:pointer;background:#fff;padding:0;transition:border-color .12s,transform .12s;font:inherit;}
  .es-vopt:hover{transform:translateY(-1px);} .es-vopt.on{border-color:var(--coral);box-shadow:0 0 0 2px var(--coral-tint);}
  .es-vv{height:34px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .es-vl{font-size:9.5px;font-weight:600;color:var(--ink2);padding:5px 4px;text-align:center;white-space:nowrap;display:block;}
  .es-seg{display:inline-flex;border:1px solid var(--hair);border-radius:9px;overflow:hidden;background:#fff;}
  .es-seg button{font:inherit;font-size:12px;font-weight:600;padding:8px 14px;cursor:pointer;color:var(--ink2);border:none;border-left:1px solid var(--hair);background:none;}
  .es-seg button:first-child{border-left:none;} .es-seg button.on{background:var(--ink);color:#fff;}
  .es-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px;} .es-toggle span{font-size:12.5px;color:var(--ink);font-weight:500;}
  .es-tg{width:38px;height:22px;border-radius:999px;border:none;background:var(--hair);position:relative;cursor:pointer;transition:background .15s;flex:none;} .es-tg i{position:absolute;top:2.5px;left:2.5px;width:17px;height:17px;border-radius:50%;background:#fff;transition:left .16s;box-shadow:0 1px 3px rgba(0,0,0,.25);} .es-tg.on{background:var(--coral);} .es-tg.on i{left:18.5px;}
  .es-pals{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:4px;}
  .es-pal{cursor:pointer;border:1.5px solid var(--hair);border-radius:9px;overflow:hidden;background:var(--card2);padding:0;} .es-pal:hover{border-color:var(--coral);}
  .es-pal-sw{height:24px;display:flex;} .es-pal-sw i{flex:1;} .es-pal-nm{font-size:9.5px;font-weight:600;color:var(--ink2);padding:4px 6px 5px;display:block;}
  .es-cgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;} @media(max-width:1050px){.es-cgrid{grid-template-columns:1fr;}}
  .es-ccell{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--hair);border-radius:9px;padding:7px 8px;}
  .es-cs{width:30px;height:30px;border-radius:7px;flex:none;border:1px solid var(--hair);position:relative;overflow:hidden;cursor:pointer;}
  .es-cs input{position:absolute;inset:-6px;width:150%;height:150%;border:none;padding:0;cursor:pointer;opacity:0;}
  .es-cx{min-width:0;flex:1;} .es-cx b{display:block;font-size:11px;font-weight:650;color:var(--ink);} .es-cx input[type=text]{width:100%;border:none;background:none;font-size:11px;color:var(--ink3);font-family:ui-monospace,monospace;padding:0;outline:none;}
  .es-eye{color:var(--ink3);font-size:14px;cursor:pointer;flex:none;background:none;border:none;padding:2px;} .es-eye:hover{color:var(--coral);}
  .es-gbar{height:38px;border-radius:9px;position:relative;margin-bottom:12px;border:1px solid var(--hair);touch-action:none;}
  .es-gstop{position:absolute;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,.3);box-shadow:0 2px 7px rgba(0,0,0,.35);cursor:grab;touch-action:none;} .es-gstop:active{cursor:grabbing;}
  .es-grow{display:flex;align-items:center;gap:9px;} .es-grow input[type=color]{width:28px;height:28px;border:1px solid var(--hair);border-radius:7px;background:none;cursor:pointer;padding:2px;flex:none;}
  .es-ramp{background:#fff;border:1px solid var(--hair);border-radius:9px;padding:13px 15px;margin-bottom:13px;overflow:hidden;}
  .es-r1{line-height:1.1;letter-spacing:-0.01em;color:var(--ink);} .es-r3{font-weight:700;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-top:9px;} .es-rb{color:var(--ink2);margin-top:4px;line-height:1.5;font-size:14px;}
  .es-fontsel{width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--hair);border-radius:8px;background:#fff;color:var(--ink);cursor:pointer;}
  .es-upload{font:inherit;font-size:11.5px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid var(--hair);background:var(--card2);color:var(--ink);cursor:pointer;} .es-upload:hover{border-color:var(--coral);} .es-upload:disabled{opacity:.6;cursor:default;}
  .es-nudge{margin:9px 0 2px;font-size:11.5px;color:var(--ink3);line-height:1.5;} .es-link{font:inherit;font-size:inherit;background:none;border:none;padding:0;color:var(--coral-deep);font-weight:700;cursor:pointer;}
  .es-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-top:1px solid var(--hair);background:#fff;}
  .es-backbtn{font:inherit;font-size:13px;font-weight:650;color:var(--ink2);background:none;border:none;cursor:pointer;padding:6px 2px;} .es-backbtn:hover{color:var(--ink);}
  .es-fr{display:flex;align-items:center;gap:12px;} .es-saved{font-size:12px;font-weight:700;color:#16a34a;}
  .es-btn{font:inherit;font-size:13px;font-weight:700;color:#fff;border:none;border-radius:9px;padding:10px 18px;cursor:pointer;background:linear-gradient(180deg,#FF7A5C,#E2452A);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 14px -5px rgba(255,107,74,.5);transition:filter .15s,transform .12s;display:inline-flex;align-items:center;gap:6px;}
  .es-btn:hover:not(:disabled){filter:brightness(1.04);transform:translateY(-1px);} .es-btn:disabled{background:rgba(0,0,0,.08);color:#9ca3af;cursor:default;box-shadow:none;} .es-arr{transition:transform .16s;} .es-btn:hover .es-arr{transform:translateX(3px);}
  .es-err{margin:10px 18px 0;font-size:12px;color:#dc2626;}
  .es-right{display:flex;flex-direction:column;min-height:0;background:#E9E5DF;}
  .es-pv-top{display:flex;flex-direction:column;gap:10px;padding:15px 18px 12px;flex:none;border-bottom:1px solid var(--hair2);}
  .es-pv-caprow{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
  .es-pv-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
  .es-pv-cap{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);} .es-pv-hint{font-size:10.5px;color:var(--ink3);font-weight:500;}
  .es-tabs{display:flex;gap:4px;flex-wrap:wrap;}
  .es-send{padding:7px 14px;font-size:12px;}
  .es-tab{font:inherit;font-size:11px;font-weight:600;padding:5px 11px;border-radius:999px;border:1px solid var(--hair);background:#fff;color:var(--ink2);cursor:pointer;} .es-tab.on{background:var(--ink);color:#fff;border-color:var(--ink);}
  .es-stage{flex:1;min-height:0;overflow-y:auto;padding:22px 20px;display:flex;justify-content:center;align-items:flex-start;scrollbar-width:thin;scrollbar-color:var(--scroll) transparent;transition:background .2s;}
  .es-stage::-webkit-scrollbar{width:10px;} .es-stage::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:6px;border:3px solid transparent;background-clip:padding-box;}
  .es-edit{position:relative;cursor:pointer;transition:box-shadow .12s;}
  .es-edit:hover{box-shadow:inset 0 0 0 2px rgba(255,107,74,.6);}
  .es-edit:hover::after{content:attr(data-tip);position:absolute;top:6px;right:6px;background:#1a1a1a;color:#fff;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 7px;border-radius:5px;z-index:5;}
  .es-cap{flex:none;margin:0;padding:12px 18px 14px;font-size:11.5px;color:var(--ink3);background:#E9E5DF;}
`;
