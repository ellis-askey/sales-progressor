"use client";

// Director-only: the agency's client-email branding — logo band (top) + the hero
// band, CTA button, links and footer beneath it. The preview renders through the
// SAME helpers the emails use (lib/email/logo-header.ts + lib/email/brand-theme.ts)
// so what's shown here is what recipients receive; it can't drift.

import { useMemo, useRef, useState } from "react";
import {
  LOGO_HEIGHTS,
  LOGO_BAND_PADDING_Y,
  LOGO_BAND_PADDING_X,
  LOGO_MAX_WIDTH,
} from "@/lib/email/logo-header";
import {
  resolveEmailTheme,
  type EmailThemeInput,
  type GradientDir,
  type BandShape,
} from "@/lib/email/brand-theme";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const ALLOWED = new Set(ACCEPT.split(","));
const WHITE = "#ffffff";
const DARK = "#12233b";
const HEX = /^#[0-9a-fA-F]{6}$/;

// Coral defaults — mirror lib/email/brand-theme.ts so the controls show the
// current look before any customisation.
const D_HEADER = "#FF8A65";
const D_HEADER_2 = "#FFB74D";
const D_BUTTON = "#FF6B4A";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PREVIEW_TYPES = [
  { key: "milestone", label: "Milestone", eyebrow: "14 Maple Grove, Harborne", headline: "Mortgage offer received", sub: "Your sale is moving forward.", cta: "View your sale" },
  { key: "invite", label: "Portal invite", eyebrow: "14 Maple Grove, Harborne", headline: "Your sale portal is ready", sub: "Track every step in one place.", cta: "Open my portal" },
  { key: "completion", label: "Completion", eyebrow: "14 Maple Grove, Harborne", headline: "Completion confirmed", sub: "The keys are yours.", cta: "See what happens next" },
] as const;

export interface BrandingInitial {
  logoUrl: string | null;
  tileColor: string | null;
  scale: LogoScale | null;
  align: LogoAlign | null;
  theme?: EmailThemeInput | null;
  appAccent?: string | null; // the "Your app colour" accent, for "Match my app colour"
}

export function EmailBrandingStudio({
  initial,
  endpoint = "/api/agent/agency-logo",
}: {
  initial: BrandingInitial;
  endpoint?: string;
}) {
  // ── Logo state ──
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [autoColor, setAutoColor] = useState(initial.tileColor ?? WHITE);
  const [tileColor, setTileColor] = useState(initial.tileColor ?? WHITE);
  const [scale, setScale] = useState<LogoScale>(initial.scale ?? "md");
  const [align, setAlign] = useState<LogoAlign>(initial.align ?? "left");

  // ── Theme state (initialised from the stored theme, else coral defaults so the
  // controls reflect the current look) ──
  const th = initial.theme ?? {};
  const [headerMode, setHeaderMode] = useState<"solid" | "gradient">(
    th.headerColor ? (th.headerColor2 ? "gradient" : "solid") : "gradient",
  );
  const [headerColor, setHeaderColor] = useState(th.headerColor ?? D_HEADER);
  const [headerColor2, setHeaderColor2] = useState(th.headerColor2 ?? D_HEADER_2);
  const [gradientDir, setGradientDir] = useState<GradientDir>(th.gradientDir ?? "diagonal");
  const [buttonColor, setButtonColor] = useState(th.buttonColor ?? D_BUTTON);
  const [headerTextMode, setHeaderTextMode] = useState<"auto" | "custom">(th.headerTextColor ? "custom" : "auto");
  const [headerTextColor, setHeaderTextColor] = useState(th.headerTextColor ?? WHITE);
  const [linkColor, setLinkColor] = useState(th.linkColor ?? th.buttonColor ?? D_BUTTON);
  const [footerMode, setFooterMode] = useState<"default" | "custom">(th.footerBg ? "custom" : "default");
  const [footerBg, setFooterBg] = useState(th.footerBg ?? "#f4f4f6");
  const [footerText, setFooterText] = useState(th.footerText ?? "#6b7280");
  const [bandShape, setBandShape] = useState<BandShape>(th.bandShape ?? "rounded");
  const [advanced, setAdvanced] = useState(false);
  const [previewType, setPreviewType] = useState<(typeof PREVIEW_TYPES)[number]["key"]>("milestone");

  const [busy, setBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shownLogo = localPreview ?? logoUrl;

  const buildTheme = useMemo<() => EmailThemeInput>(() => () => {
    const t: EmailThemeInput = { headerColor, buttonColor, linkColor, bandShape };
    if (headerMode === "gradient") { t.headerColor2 = headerColor2; t.gradientDir = gradientDir; }
    if (headerTextMode === "custom") t.headerTextColor = headerTextColor;
    if (footerMode === "custom") { t.footerBg = footerBg; t.footerText = footerText; }
    return t;
  }, [headerColor, headerColor2, gradientDir, headerMode, buttonColor, linkColor, bandShape, headerTextMode, headerTextColor, footerMode, footerBg, footerText]);

  const theme = useMemo(() => resolveEmailTheme(buildTheme()), [buildTheme]);
  const themeJson = JSON.stringify(buildTheme());

  const [saved, setSaved] = useState({
    tileColor: initial.tileColor ?? WHITE,
    scale: initial.scale ?? ("md" as LogoScale),
    align: initial.align ?? ("left" as LogoAlign),
  });
  const [savedThemeJson, setSavedThemeJson] = useState(themeJson);

  const dirty =
    tileColor !== saved.tileColor || scale !== saved.scale || align !== saved.align || themeJson !== savedThemeJson;

  function touch() { setSavingState("idle"); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED.has(file.type)) { setError("Please choose a PNG, JPG, WebP or SVG."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    setLocalPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataBase64, mimetype: file.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); setLocalPreview(null); return; }
      setLogoUrl(`${json.url}?t=${Date.now()}`);
      setLocalPreview(null);
      setAutoColor(json.tileColor);
      setTileColor(json.tileColor);
      setScale(json.scale);
      setAlign(json.align);
      setSaved((s) => ({ ...s, tileColor: json.tileColor, scale: json.scale, align: json.align }));
      setSavingState("saved");
    } catch {
      setError("Upload failed. Try again.");
      setLocalPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setSavingState("saving");
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tileColor, scale, align, theme: buildTheme() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't save your changes.");
        setSavingState("idle");
        return;
      }
      setSaved({ tileColor, scale, align });
      setSavedThemeJson(themeJson);
      setSavingState("saved");
    } catch {
      setError("Couldn't save your changes.");
      setSavingState("idle");
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't remove the logo."); return; }
      setLogoUrl(null); setLocalPreview(null);
      setTileColor(WHITE); setAutoColor(WHITE); setScale("md"); setAlign("left");
      setSaved((s) => ({ ...s, tileColor: WHITE, scale: "md", align: "left" }));
      setSavingState("idle");
    } finally {
      setBusy(false);
    }
  }

  const pt = PREVIEW_TYPES.find((p) => p.key === previewType)!;
  const swatches = [
    { key: "auto", label: "Auto", color: autoColor },
    { key: "white", label: "White", color: WHITE },
    { key: "dark", label: "Dark", color: DARK },
  ];

  return (
    <div className="eb-grid">
      {/* ── Live preview ── */}
      <div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {PREVIEW_TYPES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreviewType(p.key)}
              aria-pressed={p.key === previewType}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
                border: p.key === previewType ? "1px solid #111827" : "1px solid rgba(0,0,0,0.14)",
                background: p.key === previewType ? "#111827" : "#fff", color: p.key === previewType ? "#fff" : "#4b5563",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16, overflow: "hidden", maxWidth: 460, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", background: "#fff" }}>
          {shownLogo && (
            <div style={{ background: tileColor, padding: `${LOGO_BAND_PADDING_Y[scale]}px ${LOGO_BAND_PADDING_X}px`, textAlign: align === "center" ? "center" : "left" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownLogo} alt="Agency logo" style={{ height: LOGO_HEIGHTS[scale], maxWidth: LOGO_MAX_WIDTH, objectFit: "contain", display: align === "center" ? "inline-block" : "block", opacity: busy ? 0.5 : 1 }} />
            </div>
          )}
          {/* Hero band */}
          <div style={{ background: theme.headerBg, padding: "26px 28px", borderRadius: theme.bandRadius }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.headerText === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.55)" }}>
              {pt.eyebrow}
            </p>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.headerText, lineHeight: 1.3 }}>{pt.headline}</h1>
          </div>
          {/* Body */}
          <div style={{ padding: "20px 28px 26px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#4a5162", lineHeight: 1.5 }}>{pt.sub}</p>
            <a style={{ display: "inline-block", background: theme.buttonBg, color: theme.buttonText, padding: "11px 22px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>{pt.cta}</a>
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "#8b91a3" }}>
              Questions? <span style={{ color: theme.linkColor, fontWeight: 600 }}>Get in touch</span>.
            </p>
          </div>
          {theme.footerBg && (
            <div style={{ background: theme.footerBg, padding: "12px 28px" }}>
              <p style={{ margin: 0, fontSize: 11, color: theme.footerText }}>Your agency name</p>
            </div>
          )}
        </div>
        <p style={{ margin: "8px 2px 0", fontSize: 12, color: "#9ca3af" }}>A live preview of the emails your clients receive.</p>

        {/* Advanced (Tier 2) sits under the preview to balance the two columns. */}
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 16 }}>
          <button type="button" onClick={() => setAdvanced((a) => !a)} style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, color: "#4b5563", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {advanced ? "Hide advanced" : "Advanced options"} {advanced ? "▲" : "▼"}
          </button>
          {advanced && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Control label="Header text">
                <Segmented value={headerTextMode} onChange={(v) => { setHeaderTextMode(v as "auto" | "custom"); touch(); }} options={[{ value: "auto", label: "Auto contrast" }, { value: "custom", label: "Custom" }]} />
                {headerTextMode === "custom" && <div style={{ marginTop: 8 }}><CustomColor value={headerTextColor} onChange={(v) => { setHeaderTextColor(v); touch(); }} /></div>}
              </Control>
              <Control label="Link colour">
                <CustomColor value={linkColor} onChange={(v) => { setLinkColor(v); touch(); }} />
              </Control>
              <Control label="Footer">
                <Segmented value={footerMode} onChange={(v) => { setFooterMode(v as "default" | "custom"); touch(); }} options={[{ value: "default", label: "None" }, { value: "custom", label: "Coloured band" }]} />
                {footerMode === "custom" && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                    <CustomColor value={footerBg} onChange={(v) => { setFooterBg(v); touch(); }} label="Background" />
                    <CustomColor value={footerText} onChange={(v) => { setFooterText(v); touch(); }} label="Text" />
                  </div>
                )}
              </Control>
              <Control label="Header corners">
                <Segmented value={bandShape} onChange={(v) => { setBandShape(v as BandShape); touch(); }} options={[{ value: "rounded", label: "Rounded" }, { value: "square", label: "Square" }]} />
              </Control>
            </div>
          )}
        </div>
      </div>

      <div className="eb-col-controls" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Logo upload / replace / remove ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="eb-btn" style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.14)", background: "#fff", color: "#111827", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}
        </button>
        {logoUrl && !busy && (
          <button type="button" onClick={onRemove} className="eb-remove" style={{ fontSize: 13, fontWeight: 500, background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }}>Remove</button>
        )}
        <style>{`.eb-btn{transition:background 140ms ease,transform 90ms ease}.eb-btn:hover:not(:disabled){background:#f6f6f7!important}.eb-btn:active:not(:disabled){transform:scale(0.97)}.eb-remove:hover{color:#dc2626!important}@media(prefers-reduced-motion:reduce){.eb-btn{transition:none}.eb-btn:active:not(:disabled){transform:none}}`}</style>
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: "none" }} />
      </div>

      {/* ── Logo presentation (only with a logo) ── */}
      {logoUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Control label="Logo background">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {swatches.map((s) => (
                <SwatchButton key={s.key} label={s.label} color={s.color} active={tileColor.toLowerCase() === s.color.toLowerCase()} onClick={() => { setTileColor(s.color); touch(); }} />
              ))}
              <CustomColor value={tileColor} onChange={(v) => { setTileColor(v); touch(); }} />
            </div>
          </Control>
          <Control label="Logo size">
            <Segmented value={scale} onChange={(v) => { setScale(v as LogoScale); touch(); }} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />
          </Control>
          <Control label="Logo alignment">
            <Segmented value={align} onChange={(v) => { setAlign(v as LogoAlign); touch(); }} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} />
          </Control>
        </div>
      )}

      {/* ── Header (hero band) ── */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />
      <Control label="Header colour">
        <Segmented value={headerMode} onChange={(v) => { setHeaderMode(v as "solid" | "gradient"); touch(); }} options={[{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }]} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <CustomColor value={headerColor} onChange={(v) => { setHeaderColor(v); touch(); }} label={headerMode === "gradient" ? "From" : "Colour"} />
          {headerMode === "gradient" && <CustomColor value={headerColor2} onChange={(v) => { setHeaderColor2(v); touch(); }} label="To" />}
          <LinkBtn onClick={() => { setHeaderColor(HEX.test(tileColor) ? tileColor : autoColor); if (headerMode === "gradient") setHeaderColor2(HEX.test(tileColor) ? tileColor : autoColor); touch(); }}>Match my logo</LinkBtn>
          {initial.appAccent && HEX.test(initial.appAccent) && (
            <LinkBtn onClick={() => { setHeaderColor(initial.appAccent!); if (headerMode === "gradient") setHeaderColor2(initial.appAccent!); touch(); }}>Match my app colour</LinkBtn>
          )}
        </div>
        {headerMode === "gradient" && (
          <div style={{ marginTop: 8 }}>
            <Segmented value={gradientDir} onChange={(v) => { setGradientDir(v as GradientDir); touch(); }} options={[{ value: "horizontal", label: "Horizontal" }, { value: "diagonal", label: "Diagonal" }, { value: "vertical", label: "Vertical" }]} />
          </div>
        )}
      </Control>

      {/* ── Button ── */}
      <Control label="Button colour">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <CustomColor value={buttonColor} onChange={(v) => { setButtonColor(v); touch(); }} />
          <LinkBtn onClick={() => { setButtonColor(headerColor); touch(); }}>Match header</LinkBtn>
        </div>
      </Control>

      {/* ── Save ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 2 }}>
        <button type="button" onClick={onSave} disabled={!dirty || savingState === "saving"} style={{ fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 8, border: "none", background: !dirty ? "rgba(0,0,0,0.08)" : "#FF6B4A", color: !dirty ? "#9ca3af" : "#fff", cursor: !dirty || savingState === "saving" ? "default" : "pointer" }}>
          {savingState === "saving" ? "Saving…" : "Save changes"}
        </button>
        {!dirty && savingState === "saved" && <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Saved</span>}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        Text colours over your header and button are chosen automatically for legibility. Only your client-facing emails use these colours.
      </p>
      {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }} role="alert">{error}</p>}
      </div>
      <style>{`.eb-grid{display:grid;grid-template-columns:minmax(0,440px) 1fr;gap:28px;align-items:start}.eb-col-controls{min-width:0}@media(max-width:820px){.eb-grid{grid-template-columns:1fr}}`}</style>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
      {children}
    </div>
  );
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ fontSize: 12, fontWeight: 600, background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}>
      {children}
    </button>
  );
}

function SwatchButton({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={label} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 6px", borderRadius: 999, cursor: "pointer", border: active ? "2px solid #111827" : "1px solid rgba(0,0,0,0.14)", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: color, border: "1px solid rgba(0,0,0,0.12)" }} />
      {label}
    </button>
  );
}

function CustomColor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
      <input type="color" value={HEX.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} style={{ width: 28, height: 28, padding: 0, border: "1px solid rgba(0,0,0,0.14)", borderRadius: 6, background: "none", cursor: "pointer" }} />
      {label ?? "Custom"}
    </label>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={active} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", cursor: "pointer", border: "none", borderLeft: i === 0 ? "none" : "1px solid rgba(0,0,0,0.10)", background: active ? "#111827" : "#fff", color: active ? "#fff" : "#374151" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
