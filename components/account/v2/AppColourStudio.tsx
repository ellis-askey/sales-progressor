"use client";

// App Colour Studio — the richer replacement for the single-hex BrandColorPicker.
// Scope (confirmed with Ellis): a per-USER accent that paints the general theme
// (links, focus, tints, ambient glow) PLUS a customisable PRIMARY BUTTON that can
// be a solid fill or a two-stop gradient at any angle. Glass cards and the
// semantic status colours (green / amber / red) stay fixed.
//
// This file is self-contained (its own styles + colour maths) so it renders
// correctly in the /dev sandbox with no agent-shell context. When wired, it keeps
// the same `initial` + `onSave` contract; the save path extends lib/agent/
// brand-theme.ts + .agent-btn-primary + updateBrandColor to consume these tokens.

import { useEffect, useMemo, useState } from "react";
import { Palette, ArrowCounterClockwise, Check, Warning } from "@phosphor-icons/react";

// ── Config ────────────────────────────────────────────────────────────────────

export type AppColourConfig = {
  accent: string; // the general theme accent (links, focus, tints, glow)
  gradient: { enabled: boolean; from: string; to: string; angle: number }; // primary button
  buttonText: "auto" | "light" | "dark";
};

export const DEFAULT_APP_COLOUR: AppColourConfig = {
  accent: "#ff6b4a",
  gradient: { enabled: true, from: "#ff6b4a", to: "#ff8a65", angle: 135 },
  buttonText: "auto",
};

// ── Colour maths (no deps) ──────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function normHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}
function toRgb(hex: string) { const h = hex.replace(/^#/, ""); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
function toHex(r: number, g: number, b: number) { const c = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"); return `#${c(r)}${c(g)}${c(b)}`; }
function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255, gg = g / 255, bb = b / 255, max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0; if (d) { if (max === rr) h = ((gg - bb) / d) % 6; else if (max === gg) h = (bb - rr) / d + 2; else h = (rr - gg) / d + 4; h = (h * 60 + 360) % 360; }
  const l = (max + min) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h: number, s: number, l: number) {
  const ss = s / 100, ll = l / 100, c = (1 - Math.abs(2 * ll - 1)) * ss, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function shiftL(hex: string, dl: number) { const { r, g, b } = toRgb(hex); const { h, s, l } = rgbToHsl(r, g, b); return hslToHex(h, s, clamp(l + dl, 0, 100)); }
function lift(hex: string, darkMode: boolean) { if (!darkMode) return hex; const { r, g, b } = toRgb(hex); const { h, s, l } = rgbToHsl(r, g, b); return hslToHex(h, clamp(s, 45, 100), clamp(l, 52, 70)); }
function lumin(hex: string) { const { r, g, b } = toRgb(hex); const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrast(a: string, b: string) { const la = lumin(a), lb = lumin(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

// Auto gradient derived from a single accent — matches today's engine (deep -> +8L).
function autoGradient(accent: string): { from: string; to: string } { return { from: accent, to: shiftL(accent, 10) }; }

// ── Presets ("Looks") ────────────────────────────────────────────────────────

const LOOKS: Array<{ name: string; cfg: AppColourConfig }> = [
  { name: "Coral",    cfg: { accent: "#ff6b4a", gradient: { enabled: true,  from: "#ff6b4a", to: "#ff8a65", angle: 135 }, buttonText: "auto" } },
  { name: "Ocean",    cfg: { accent: "#2563eb", gradient: { enabled: true,  from: "#2563eb", to: "#3b82f6", angle: 135 }, buttonText: "auto" } },
  { name: "Teal",     cfg: { accent: "#0891b2", gradient: { enabled: true,  from: "#0891b2", to: "#06b6d4", angle: 135 }, buttonText: "auto" } },
  { name: "Forest",   cfg: { accent: "#16a34a", gradient: { enabled: true,  from: "#15803d", to: "#22c55e", angle: 135 }, buttonText: "auto" } },
  { name: "Violet",   cfg: { accent: "#7c3aed", gradient: { enabled: true,  from: "#7c3aed", to: "#a855f7", angle: 135 }, buttonText: "auto" } },
  { name: "Sunset",   cfg: { accent: "#ff6b4a", gradient: { enabled: true,  from: "#f43f5e", to: "#fb923c", angle: 120 }, buttonText: "auto" } },
  { name: "Midnight", cfg: { accent: "#0ea5a4", gradient: { enabled: true,  from: "#0f3845", to: "#0ea5a4", angle: 135 }, buttonText: "light" } },
  { name: "Graphite", cfg: { accent: "#334155", gradient: { enabled: false, from: "#334155", to: "#334155", angle: 135 }, buttonText: "light" } },
];

const SUGGESTED = ["#ff6b4a", "#2563eb", "#0891b2", "#16a34a", "#7c3aed", "#db2777", "#d97706", "#0f3845"];

// ── Small UI atoms ───────────────────────────────────────────────────────────

function Swatch({ label, value, onChange, small }: { label?: string; value: string; onChange: (hex: string) => void; small?: boolean }) {
  const [text, setText] = useState(value);
  // Sync the hex field when the parent changes the colour externally (preset,
  // suggestion, "match to accent"), while still allowing free in-progress typing.
  useEffect(() => { setText(value); }, [value]);
  const size = small ? 34 : 46;
  return (
    <div className="acs-swatchrow">
      <label className="acs-swatch" style={{ width: size, height: size, background: value }}>
        <input type="color" value={value} onChange={(e) => { onChange(e.target.value); setText(e.target.value); }} aria-label={label ?? "Pick colour"} />
      </label>
      <div className="acs-hexwrap">
        {label && <span className="acs-eyebrow">{label}</span>}
        <input
          className="acs-hex" type="text" spellCheck={false} value={text}
          onChange={(e) => { setText(e.target.value); const n = normHex(e.target.value); if (n) onChange(n); }}
          onBlur={() => { const n = normHex(text); setText(n ?? value); }}
        />
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="acs-seg" role="tablist">
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={value === o.v} className={`acs-seg-btn${value === o.v ? " on" : ""}`} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function AppColourStudio({
  initial = DEFAULT_APP_COLOUR,
  onSave,
}: {
  initial?: AppColourConfig;
  onSave?: (config: AppColourConfig) => void | Promise<void>;
}) {
  const [cfg, setCfg] = useState<AppColourConfig>(initial);
  const [saved, setSaved] = useState<AppColourConfig>(initial);
  const [previewDark, setPreviewDark] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const setGrad = (patch: Partial<AppColourConfig["gradient"]>) => setCfg((c) => ({ ...c, gradient: { ...c.gradient, ...patch } }));

  // When the accent changes and the gradient is still "auto" (its from==accent),
  // keep the gradient tracking the accent so the simple path stays simple.
  function setAccent(hex: string) {
    setCfg((c) => {
      const wasAuto = c.gradient.from.toLowerCase() === c.accent.toLowerCase();
      const g = wasAuto ? { ...c.gradient, ...autoGradient(hex) } : c.gradient;
      return { ...c, accent: hex, gradient: g };
    });
  }

  // Preview-resolved colours (dark lifts the accent, like the real engine).
  const pv = useMemo(() => {
    const accent = lift(cfg.accent, previewDark);
    const from = lift(cfg.gradient.from, previewDark);
    const to = lift(cfg.gradient.to, previewDark);
    const btnBg = cfg.gradient.enabled ? `linear-gradient(${cfg.gradient.angle}deg, ${from}, ${to})` : accent;
    const stops = cfg.gradient.enabled ? [from, to] : [accent];
    const repLum = stops.reduce((s, h) => s + lumin(h), 0) / stops.length;
    const autoText = repLum > 0.5 ? "#1a1512" : "#ffffff";
    const text = cfg.buttonText === "auto" ? autoText : cfg.buttonText === "light" ? "#ffffff" : "#1a1512";
    const worst = Math.min(...stops.map((h) => contrast(text, h)));
    const grade: "aa" | "large" | "fail" = worst >= 4.5 ? "aa" : worst >= 3 ? "large" : "fail";
    return { accent, btnBg, text, worst, grade };
  }, [cfg, previewDark]);

  async function save() {
    setBusy(true);
    try { await onSave?.(cfg); setSaved(cfg); } finally { setBusy(false); }
  }

  return (
    <div className="acs">
      <style>{ACS_CSS}</style>

      <div className="acs-head">
        <span className="acs-head-ic" style={{ background: pv.btnBg }}><Palette size={18} weight="fill" color={pv.text} /></span>
        <div>
          <h2 className="acs-title">Your app colour</h2>
          <p className="acs-sub">Make Sales Progressor yours. Set the accent that runs through the app and design your primary button. Glass cards and the status colours (green / amber / red) stay the same.</p>
        </div>
      </div>

      <div className="acs-grid">
        {/* ── Controls ── */}
        <div className="acs-controls">

          <section className="acs-sec">
            <h3 className="acs-sec-h">Accent colour</h3>
            <p className="acs-sec-d">The colour that runs through links, highlights, focus rings and the ambient glow.</p>
            <Swatch label="Hex" value={cfg.accent} onChange={setAccent} />
            <div className="acs-suggest">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" title={s} aria-label={`Use ${s}`} className={`acs-dot${s.toLowerCase() === cfg.accent.toLowerCase() ? " on" : ""}`} style={{ background: s }} onClick={() => setAccent(s)} />
              ))}
            </div>
          </section>

          <section className="acs-sec">
            <div className="acs-sec-top">
              <div>
                <h3 className="acs-sec-h">Primary button</h3>
                <p className="acs-sec-d">A solid fill, or a gradient between two colours at any angle.</p>
              </div>
              <Segmented value={cfg.gradient.enabled ? "gradient" : "solid"} options={[{ v: "solid", label: "Solid" }, { v: "gradient", label: "Gradient" }]} onChange={(v) => setGrad({ enabled: v === "gradient" })} />
            </div>

            {cfg.gradient.enabled ? (
              <div className="acs-grad">
                <div className="acs-grad-stops">
                  <Swatch label="From" value={cfg.gradient.from} onChange={(h) => setGrad({ from: h })} small />
                  <span className="acs-arrow" aria-hidden>→</span>
                  <Swatch label="To" value={cfg.gradient.to} onChange={(h) => setGrad({ to: h })} small />
                  <button type="button" className="acs-textlink" onClick={() => setGrad({ ...autoGradient(cfg.accent) })}>Match to accent</button>
                </div>
                <label className="acs-angle">
                  <span className="acs-eyebrow">Angle · {cfg.gradient.angle}&deg;</span>
                  <input type="range" min={0} max={360} step={5} value={cfg.gradient.angle} onChange={(e) => setGrad({ angle: Number(e.target.value) })} style={{ accentColor: pv.accent }} />
                </label>
              </div>
            ) : (
              <div className="acs-solidnote">The button uses your accent colour as a flat fill.</div>
            )}

            <div className="acs-btnrow">
              <div>
                <span className="acs-eyebrow">Button text</span>
                <Segmented value={cfg.buttonText} options={[{ v: "auto", label: "Auto" }, { v: "light", label: "White" }, { v: "dark", label: "Dark" }]} onChange={(v) => setCfg((c) => ({ ...c, buttonText: v }))} />
              </div>
              <span className={`acs-contrast acs-contrast--${pv.grade}`} title={`Text contrast ${pv.worst.toFixed(1)}:1`}>
                {pv.grade === "fail" ? <Warning size={13} weight="fill" /> : <Check size={13} weight="bold" />}
                {pv.grade === "aa" ? "Good contrast" : pv.grade === "large" ? "OK on buttons" : "Low contrast"}
              </span>
            </div>
          </section>

          <section className="acs-sec">
            <h3 className="acs-sec-h">Looks</h3>
            <p className="acs-sec-d">A one-tap starting point. Tweak anything after.</p>
            <div className="acs-looks">
              {LOOKS.map((l) => {
                const bg = l.cfg.gradient.enabled ? `linear-gradient(${l.cfg.gradient.angle}deg, ${l.cfg.gradient.from}, ${l.cfg.gradient.to})` : l.cfg.accent;
                const on = JSON.stringify(l.cfg) === JSON.stringify(cfg);
                return (
                  <button key={l.name} type="button" className={`acs-look${on ? " on" : ""}`} onClick={() => setCfg(l.cfg)}>
                    <span className="acs-look-sw" style={{ background: bg }} />
                    <span className="acs-look-n">{l.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Live preview ── */}
        <div className="acs-previewwrap">
          <div className="acs-preview-top">
            <span className="acs-eyebrow">Live preview</span>
            <Segmented value={previewDark ? "dark" : "light"} options={[{ v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} onChange={(v) => setPreviewDark(v === "dark")} />
          </div>

          <div className={`acs-stage${previewDark ? " dark" : ""}`} style={{ ["--acc" as string]: pv.accent, ["--accrgb" as string]: (() => { const { r, g, b } = toRgb(pv.accent); return `${r}, ${g}, ${b}`; })() }}>
            <div className="acs-card">
              <div className="acs-card-hdr">Work queue</div>
              <div className="acs-card-body">
                <p className="acs-card-title">Initial enquiries raised by Clarke &amp; Mortimer</p>
                <p className="acs-card-desc">The automated chases are done, but enquiries still haven&rsquo;t been raised. Time to follow up directly.</p>
                <div className="acs-pills">
                  <span className="acs-pill acs-pill--acc">Buyer&rsquo;s solicitor</span>
                  <span className="acs-pill acs-pill--ok">Confirmed</span>
                  <span className="acs-pill acs-pill--warn">Due today</span>
                  <span className="acs-pill acs-pill--bad">Overdue</span>
                </div>
                <div className="acs-actions">
                  <button type="button" className="acs-btn-primary" style={{ background: pv.btnBg, color: pv.text }}>Confirm</button>
                  <button type="button" className="acs-btn-ghost">Snooze</button>
                  <a className="acs-link" href="#" onClick={(e) => e.preventDefault()}>View file</a>
                </div>
                <div className="acs-field">
                  <span className="acs-eyebrow" style={{ color: pv.accent }}>Focus ring</span>
                  <input className="acs-input" defaultValue="example@agency.co.uk" />
                </div>
              </div>
            </div>
            <p className="acs-stage-note">Status pills (green / amber / red) and the glass card are fixed. Everything coral in your app takes your colour.</p>
          </div>
        </div>
      </div>

      <div className="acs-foot">
        <button type="button" className="acs-save" style={{ background: dirty ? pv.btnBg : undefined, color: dirty ? pv.text : undefined }} disabled={!dirty || busy} onClick={save}>
          {busy ? "Saving…" : "Save colour"}
        </button>
        <button type="button" className="acs-reset" onClick={() => setCfg(DEFAULT_APP_COLOUR)}><ArrowCounterClockwise size={13} weight="bold" /> Reset to default</button>
      </div>
    </div>
  );
}

// ── Styles (self-contained; warm agent-app palette) ─────────────────────────────

const ACS_CSS = `
.acs { --ink:#2d1810; --ink2:#5a3a28; --mut:rgba(45,24,16,0.55); --faint:rgba(45,24,16,0.4); --line:rgba(45,24,16,0.12); --paper:#ffffff; --bg:#faf8f6;
  font-family: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--ink); max-width:1060px; margin:0 auto; }
.acs *{ box-sizing:border-box; }
.acs-eyebrow{ font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--faint); }

.acs-head{ display:flex; gap:14px; align-items:flex-start; margin-bottom:20px; }
.acs-head-ic{ width:40px; height:40px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; box-shadow:inset 0 1px 0 rgba(255,255,255,0.3); }
.acs-title{ margin:0 0 3px; font-size:19px; font-weight:800; letter-spacing:-0.02em; }
.acs-sub{ margin:0; font-size:13px; line-height:1.55; color:var(--ink2); max-width:64ch; }

.acs-grid{ display:grid; grid-template-columns:1.05fr 0.95fr; gap:22px; align-items:start; }
@media (max-width:860px){ .acs-grid{ grid-template-columns:1fr; } }

.acs-controls{ display:flex; flex-direction:column; gap:18px; }
.acs-sec{ background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:16px 16px 17px; box-shadow:0 1px 2px rgba(40,26,20,0.04); }
.acs-sec-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.acs-sec-h{ margin:0 0 3px; font-size:13.5px; font-weight:750; letter-spacing:-0.01em; }
.acs-sec-d{ margin:0 0 13px; font-size:11.5px; line-height:1.5; color:var(--mut); }
.acs-sec-top .acs-sec-d{ margin-bottom:0; }

.acs-swatchrow{ display:flex; align-items:center; gap:12px; }
.acs-swatch{ position:relative; border-radius:11px; cursor:pointer; flex-shrink:0; border:0.5px solid rgba(0,0,0,0.14); box-shadow:inset 0 1px 0 rgba(255,255,255,0.35); }
.acs-swatch input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.acs-hexwrap{ display:flex; flex-direction:column; gap:4px; }
.acs-hex{ width:130px; padding:8px 10px; font:inherit; font-size:13.5px; font-family:ui-monospace,monospace; color:var(--ink); background:#fff; border:0.5px solid rgba(0,0,0,0.16); border-radius:8px; outline:none; }
.acs-hex:focus{ border-color:var(--ink2); }

.acs-suggest{ display:flex; align-items:center; gap:7px; margin-top:12px; flex-wrap:wrap; }
.acs-dot{ width:24px; height:24px; border-radius:7px; cursor:pointer; border:0.5px solid rgba(0,0,0,0.12); padding:0; transition:transform .12s; }
.acs-dot:hover{ transform:translateY(-1px); }
.acs-dot.on{ outline:2px solid var(--ink); outline-offset:1px; }

.acs-seg{ display:inline-flex; background:rgba(45,24,16,0.05); border-radius:9px; padding:3px; gap:2px; }
.acs-seg-btn{ appearance:none; border:none; background:none; font:inherit; font-size:12px; font-weight:600; color:var(--mut); padding:5px 11px; border-radius:7px; cursor:pointer; transition:background .14s,color .14s; }
.acs-seg-btn.on{ background:#fff; color:var(--ink); box-shadow:0 1px 2px rgba(40,26,20,0.12); }

.acs-grad{ margin-top:14px; display:flex; flex-direction:column; gap:14px; }
.acs-grad-stops{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.acs-arrow{ color:var(--faint); font-weight:700; }
.acs-textlink{ appearance:none; background:none; border:none; font:inherit; font-size:11.5px; font-weight:700; color:var(--acc,#e2452a); cursor:pointer; margin-left:auto; }
.acs-textlink:hover{ text-decoration:underline; }
.acs-angle{ display:flex; flex-direction:column; gap:6px; }
.acs-angle input{ width:100%; cursor:pointer; }
.acs-solidnote{ margin-top:12px; font-size:12px; color:var(--mut); }

.acs-btnrow{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-top:15px; flex-wrap:wrap; }
.acs-btnrow .acs-eyebrow{ display:block; margin-bottom:6px; }
.acs-contrast{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:4px 9px; border-radius:999px; }
.acs-contrast--aa{ color:#1f8a4a; background:rgba(31,138,74,0.12); }
.acs-contrast--large{ color:#c97d1a; background:rgba(201,125,26,0.14); }
.acs-contrast--fail{ color:#c73e3e; background:rgba(199,62,62,0.12); }

.acs-looks{ display:grid; grid-template-columns:repeat(4,1fr); gap:9px; }
@media (max-width:520px){ .acs-looks{ grid-template-columns:repeat(2,1fr); } }
.acs-look{ appearance:none; background:#fff; border:1px solid var(--line); border-radius:11px; padding:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px; transition:transform .12s,border-color .14s,box-shadow .16s; }
.acs-look:hover{ transform:translateY(-2px); box-shadow:0 8px 18px -12px rgba(40,26,20,0.35); }
.acs-look.on{ border-color:var(--ink); }
.acs-look-sw{ width:100%; height:30px; border-radius:7px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.3); }
.acs-look-n{ font-size:11px; font-weight:650; color:var(--ink2); }

/* ── Preview ── */
.acs-previewwrap{ position:sticky; top:16px; display:flex; flex-direction:column; gap:10px; }
.acs-preview-top{ display:flex; align-items:center; justify-content:space-between; }
.acs-stage{ border-radius:18px; padding:18px; background:radial-gradient(70% 60% at 85% 0%, rgba(var(--accrgb),0.10) 0%, rgba(var(--accrgb),0) 60%), linear-gradient(170deg,#faf8f6,#f1ece7); border:1px solid var(--line); }
.acs-stage.dark{ background:radial-gradient(70% 60% at 85% 0%, rgba(var(--accrgb),0.16) 0%, rgba(var(--accrgb),0) 60%), linear-gradient(170deg,#1a2230,#0e131d); border-color:rgba(255,255,255,0.08); color:#f3ede7; }
.acs-card{ border-radius:16px; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.55)); border:1px solid rgba(255,255,255,0.6); box-shadow:0 16px 40px -22px rgba(40,26,20,0.3); -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px); }
.acs-stage.dark .acs-card{ background:linear-gradient(180deg, rgba(30,41,59,0.8), rgba(20,28,44,0.74)); border-color:rgba(255,255,255,0.08); }
.acs-card-hdr{ padding:8px 15px; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(var(--accrgb),1); background:rgba(var(--accrgb),0.08); border-bottom:1px solid rgba(var(--accrgb),0.14); }
.acs-stage.dark .acs-card-hdr{ color:var(--acc); }
.acs-card-body{ padding:14px 15px 16px; }
.acs-card-title{ margin:0 0 4px; font-size:13.5px; font-weight:700; }
.acs-card-desc{ margin:0 0 11px; font-size:11.5px; line-height:1.5; color:var(--mut); }
.acs-stage.dark .acs-card-desc{ color:rgba(243,237,231,0.6); }
.acs-pills{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
.acs-pill{ font-size:10.5px; font-weight:650; padding:3px 9px; border-radius:999px; }
.acs-pill--acc{ color:var(--acc); background:rgba(var(--accrgb),0.14); border:0.5px solid rgba(var(--accrgb),0.34); }
.acs-pill--ok{ color:#1f8a4a; background:rgba(31,138,74,0.14); }
.acs-pill--warn{ color:#c97d1a; background:rgba(201,125,26,0.16); }
.acs-pill--bad{ color:#c73e3e; background:rgba(199,62,62,0.14); }
.acs-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.acs-btn-primary{ appearance:none; border:none; font:inherit; font-size:12.5px; font-weight:650; padding:8px 16px; border-radius:9px; cursor:pointer; box-shadow:inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px -5px rgba(var(--accrgb),0.5); }
.acs-btn-ghost{ appearance:none; font:inherit; font-size:12.5px; font-weight:600; padding:8px 14px; border-radius:9px; cursor:pointer; color:var(--ink2); background:rgba(255,255,255,0.5); border:1px solid rgba(45,24,16,0.14); }
.acs-stage.dark .acs-btn-ghost{ color:#f3ede7; background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.14); }
.acs-link{ font-size:12.5px; font-weight:650; color:var(--acc); text-decoration:none; }
.acs-link:hover{ text-decoration:underline; }
.acs-field{ margin-top:14px; display:flex; flex-direction:column; gap:5px; }
.acs-input{ font:inherit; font-size:12.5px; padding:8px 11px; border-radius:9px; border:1.5px solid rgba(var(--accrgb),0.55); background:rgba(255,255,255,0.7); color:var(--ink); outline:none; box-shadow:0 0 0 3px rgba(var(--accrgb),0.14); }
.acs-stage.dark .acs-input{ background:rgba(15,23,42,0.5); color:#f3ede7; }
.acs-stage-note{ margin:12px 2px 0; font-size:10.5px; line-height:1.5; color:var(--faint); }
.acs-stage.dark .acs-stage-note{ color:rgba(243,237,231,0.4); }

.acs-foot{ display:flex; align-items:center; gap:14px; margin-top:20px; }
.acs-save{ appearance:none; border:none; font:inherit; font-size:13px; font-weight:650; padding:10px 20px; border-radius:10px; cursor:pointer; background:rgba(45,24,16,0.14); color:rgba(45,24,16,0.4); box-shadow:inset 0 1px 0 rgba(255,255,255,0.25); }
.acs-save:disabled{ cursor:default; }
.acs-reset{ appearance:none; background:none; border:none; font:inherit; font-size:12px; font-weight:600; color:var(--mut); cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.acs-reset:hover{ color:var(--ink2); }

@media (prefers-color-scheme: dark){
  .acs{ --ink:#f3ede7; --ink2:rgba(243,237,231,0.78); --mut:rgba(243,237,231,0.55); --faint:rgba(243,237,231,0.4); --line:rgba(255,255,255,0.1); --paper:rgba(255,255,255,0.04); --bg:#0e131d; }
  .acs-sec{ box-shadow:none; }
  .acs-hex{ background:rgba(255,255,255,0.05); color:var(--ink); }
  .acs-seg{ background:rgba(255,255,255,0.07); }
  .acs-seg-btn.on{ background:rgba(255,255,255,0.14); }
  .acs-look{ background:rgba(255,255,255,0.04); }
}
`;
