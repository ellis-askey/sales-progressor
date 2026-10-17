"use client";

// App Colour Studio — the complete app-appearance designer (richer replacement for
// the single-hex BrandColorPicker). Per-user. A stepped studio:
//   1. Colours   — separate Primary + Secondary brand colours (+ one-tap Looks)
//   2. Primary button — fill (solid / gradient + angle), text + contrast guard,
//                       shape (radius / height / width / text size), border, depth
//   3. Secondary button — style (ghost / soft / outline / filled) on the secondary
// A live preview of real app chrome (card, both buttons, pills, link, focus ring)
// sits alongside, with a light/dark toggle. Status colours + glass stay fixed.
//
// Self-contained (own styles + colour maths) so it renders in the /dev sandbox.
// Keeps an `initial` + `onSave(config)` contract; wiring later extends the
// brand-theme engine + .agent-btn-primary/.secondary + updateBrandColor.

import { useEffect, useMemo, useState } from "react";
import { Palette, SquaresFour, Cursor, ArrowCounterClockwise, Check, Warning, ArrowRight, ArrowLeft } from "@phosphor-icons/react";

// ── Config ────────────────────────────────────────────────────────────────────

export type ButtonText = "auto" | "light" | "dark";
export type SecondaryStyle = "ghost" | "soft" | "outline" | "filled";

export type AppColourConfig = {
  primary: string;
  secondary: string;
  shape: { radius: number; padX: number; padY: number; fontPx: number }; // shared by all buttons
  primaryBtn: {
    fill: "solid" | "gradient";
    gradFrom: string; gradTo: string; angle: number;
    text: ButtonText;
    border: { on: boolean; width: number; color: string };
    shadow: number; // 0–100 depth
  };
  secondaryBtn: { style: SecondaryStyle };
};

export const DEFAULT_APP_COLOUR: AppColourConfig = {
  primary: "#ff6b4a",
  secondary: "#475569",
  shape: { radius: 9, padX: 16, padY: 8, fontPx: 13 },
  primaryBtn: { fill: "gradient", gradFrom: "#ff6b4a", gradTo: "#ff8a65", angle: 135, text: "auto", border: { on: false, width: 1, color: "#ff6b4a" }, shadow: 42 },
  secondaryBtn: { style: "ghost" },
};

// ── Colour maths (no deps) ──────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function normHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}
function toRgb(hex: string) { const h = hex.replace(/^#/, ""); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
function rgbStr(hex: string) { const { r, g, b } = toRgb(hex); return `${r}, ${g}, ${b}`; }
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
function lift(hex: string, dark: boolean) { if (!dark) return hex; const { r, g, b } = toRgb(hex); const { h, s, l } = rgbToHsl(r, g, b); return hslToHex(h, clamp(s, 45, 100), clamp(l, 52, 70)); }
function lumin(hex: string) { const { r, g, b } = toRgb(hex); const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrast(a: string, b: string) { const la = lumin(a), lb = lumin(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
function autoText(bgs: string[]): string { const avg = bgs.reduce((s, h) => s + lumin(h), 0) / bgs.length; return avg > 0.5 ? "#1a1512" : "#ffffff"; }
function autoGradient(from: string) { return { gradFrom: from, gradTo: shiftL(from, 10) }; }

// ── Resolve button CSS for preview ──────────────────────────────────────────────

function primaryCss(cfg: AppColourConfig, dark: boolean): React.CSSProperties {
  const p = cfg.primaryBtn;
  const from = lift(p.gradFrom, dark), to = lift(p.gradTo, dark), solid = lift(cfg.primary, dark);
  const bg = p.fill === "gradient" ? `linear-gradient(${p.angle}deg, ${from}, ${to})` : solid;
  const stops = p.fill === "gradient" ? [from, to] : [solid];
  const text = p.text === "auto" ? autoText(stops) : p.text === "light" ? "#ffffff" : "#1a1512";
  const sh = p.shadow;
  const shadow = sh > 0 ? `0 ${Math.round(sh * 0.14)}px ${Math.round(sh * 0.4)}px -${Math.round(sh * 0.2)}px rgba(${rgbStr(stops[0])}, ${(0.004 * sh).toFixed(2)})` : "none";
  return {
    background: bg, color: text,
    border: p.border.on ? `${p.border.width}px solid ${lift(p.border.color, dark)}` : "1px solid transparent",
    borderRadius: cfg.shape.radius, padding: `${cfg.shape.padY}px ${cfg.shape.padX}px`, fontSize: cfg.shape.fontPx,
    boxShadow: shadow,
  };
}
function secondaryCss(cfg: AppColourConfig, dark: boolean): React.CSSProperties {
  const s = lift(cfg.secondary, dark);
  const base: React.CSSProperties = { borderRadius: cfg.shape.radius, padding: `${cfg.shape.padY}px ${cfg.shape.padX}px`, fontSize: cfg.shape.fontPx, fontWeight: 600 };
  switch (cfg.secondaryBtn.style) {
    case "filled": return { ...base, background: s, color: autoText([s]), border: "1px solid transparent" };
    case "soft": return { ...base, background: `rgba(${rgbStr(s)}, 0.14)`, color: s, border: "1px solid transparent" };
    case "outline": return { ...base, background: "transparent", color: s, border: `1.5px solid ${s}` };
    default: return { ...base, background: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)", color: dark ? "#f3ede7" : "#5a3a28", border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(45,24,16,0.14)"}` };
  }
}

// ── Looks ──────────────────────────────────────────────────────────────────────

const LOOKS: Array<{ name: string; cfg: AppColourConfig }> = [
  { name: "Coral",    cfg: DEFAULT_APP_COLOUR },
  { name: "Ocean",    cfg: { primary: "#2563eb", secondary: "#0ea5e9", shape: { radius: 9, padX: 16, padY: 8, fontPx: 13 }, primaryBtn: { fill: "gradient", gradFrom: "#2563eb", gradTo: "#3b82f6", angle: 135, text: "auto", border: { on: false, width: 1, color: "#2563eb" }, shadow: 40 }, secondaryBtn: { style: "soft" } } },
  { name: "Forest",   cfg: { primary: "#16a34a", secondary: "#334155", shape: { radius: 8, padX: 16, padY: 8, fontPx: 13 }, primaryBtn: { fill: "gradient", gradFrom: "#15803d", gradTo: "#22c55e", angle: 135, text: "auto", border: { on: false, width: 1, color: "#16a34a" }, shadow: 36 }, secondaryBtn: { style: "ghost" } } },
  { name: "Violet",   cfg: { primary: "#7c3aed", secondary: "#ec4899", shape: { radius: 12, padX: 17, padY: 9, fontPx: 13 }, primaryBtn: { fill: "gradient", gradFrom: "#7c3aed", gradTo: "#a855f7", angle: 135, text: "auto", border: { on: false, width: 1, color: "#7c3aed" }, shadow: 48 }, secondaryBtn: { style: "outline" } } },
  { name: "Midnight", cfg: { primary: "#0ea5a4", secondary: "#38bdf8", shape: { radius: 10, padX: 16, padY: 9, fontPx: 13 }, primaryBtn: { fill: "gradient", gradFrom: "#0f3845", gradTo: "#0ea5a4", angle: 135, text: "light", border: { on: false, width: 1, color: "#0ea5a4" }, shadow: 44 }, secondaryBtn: { style: "soft" } } },
  { name: "Sunset",   cfg: { primary: "#f43f5e", secondary: "#fb923c", shape: { radius: 14, padX: 18, padY: 9, fontPx: 13 }, primaryBtn: { fill: "gradient", gradFrom: "#f43f5e", gradTo: "#fb923c", angle: 120, text: "light", border: { on: false, width: 1, color: "#f43f5e" }, shadow: 50 }, secondaryBtn: { style: "ghost" } } },
  { name: "Mono pill",cfg: { primary: "#111827", secondary: "#6b7280", shape: { radius: 30, padX: 20, padY: 9, fontPx: 13 }, primaryBtn: { fill: "solid", gradFrom: "#111827", gradTo: "#111827", angle: 135, text: "light", border: { on: false, width: 1, color: "#111827" }, shadow: 22 }, secondaryBtn: { style: "outline" } } },
  { name: "Outline",  cfg: { primary: "#2563eb", secondary: "#2563eb", shape: { radius: 9, padX: 16, padY: 8, fontPx: 13 }, primaryBtn: { fill: "solid", gradFrom: "#2563eb", gradTo: "#2563eb", angle: 135, text: "light", border: { on: true, width: 1.5, color: "#1e40af" }, shadow: 0 }, secondaryBtn: { style: "ghost" } } },
];

const SUGGESTED = ["#ff6b4a", "#2563eb", "#0891b2", "#16a34a", "#7c3aed", "#db2777", "#d97706", "#0f3845", "#475569", "#111827"];

// ── UI atoms ─────────────────────────────────────────────────────────────────

function Swatch({ label, value, onChange, small }: { label?: string; value: string; onChange: (hex: string) => void; small?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  const size = small ? 32 : 44;
  return (
    <div className="acs-swatchrow">
      <label className="acs-swatch" style={{ width: size, height: size, background: value }}>
        <input type="color" value={value} onChange={(e) => { onChange(e.target.value); setText(e.target.value); }} aria-label={label ?? "Pick colour"} />
      </label>
      <div className="acs-hexwrap">
        {label && <span className="acs-eyebrow">{label}</span>}
        <input className="acs-hex" type="text" spellCheck={false} value={text}
          onChange={(e) => { setText(e.target.value); const n = normHex(e.target.value); if (n) onChange(n); }}
          onBlur={() => { const n = normHex(text); setText(n ?? value); }} />
      </div>
    </div>
  );
}
function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="acs-seg" role="tablist">{options.map((o) => <button key={o.v} type="button" role="tab" aria-selected={value === o.v} className={`acs-seg-btn${value === o.v ? " on" : ""}`} onClick={() => onChange(o.v)}>{o.label}</button>)}</div>;
}
function Slider({ label, min, max, step = 1, value, suffix = "px", onChange, accent }: { label: string; min: number; max: number; step?: number; value: number; suffix?: string; onChange: (v: number) => void; accent: string }) {
  return (
    <div className="acs-srow">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ accentColor: accent }} />
      <span className="acs-sval">{Math.round(value)}{suffix}</span>
    </div>
  );
}
function Toggle({ label, on, onChange, accent }: { label: string; on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return <div className="acs-toggle"><span>{label}</span><button type="button" className={`acs-tg${on ? " on" : ""}`} style={on ? { background: accent } : undefined} onClick={() => onChange(!on)}><i /></button></div>;
}
function Grp({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="acs-grp"><div className="acs-grp-h"><span className="acs-grp-l">{label}</span>{hint && <span className="acs-grp-hint">{hint}</span>}</div>{children}</div>;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1 as const, label: "Colours", sub: "Primary & secondary", Icon: Palette },
  { n: 2 as const, label: "Primary button", sub: "Build the perfect button", Icon: Cursor },
  { n: 3 as const, label: "Secondary button", sub: "The quieter action", Icon: SquaresFour },
];

export function AppColourStudio({ initial = DEFAULT_APP_COLOUR, onSave }: { initial?: AppColourConfig; onSave?: (config: AppColourConfig) => void | Promise<void> }) {
  const [cfg, setCfg] = useState<AppColourConfig>(initial);
  const [saved, setSaved] = useState<AppColourConfig>(initial);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const patchPrimary = (p: Partial<AppColourConfig["primaryBtn"]>) => setCfg((c) => ({ ...c, primaryBtn: { ...c.primaryBtn, ...p } }));
  const patchBorder = (p: Partial<AppColourConfig["primaryBtn"]["border"]>) => setCfg((c) => ({ ...c, primaryBtn: { ...c.primaryBtn, border: { ...c.primaryBtn.border, ...p } } }));
  const patchShape = (p: Partial<AppColourConfig["shape"]>) => setCfg((c) => ({ ...c, shape: { ...c.shape, ...p } }));

  // Changing the primary colour tracks the gradient + border colour while they're
  // still "auto" (match the accent), so the simple path stays simple.
  function setPrimary(hex: string) {
    setCfg((c) => {
      const autoGrad = c.primaryBtn.gradFrom.toLowerCase() === c.primary.toLowerCase();
      const autoBord = c.primaryBtn.border.color.toLowerCase() === c.primary.toLowerCase();
      return {
        ...c, primary: hex,
        primaryBtn: {
          ...c.primaryBtn,
          ...(autoGrad ? autoGradient(hex) : {}),
          border: { ...c.primaryBtn.border, color: autoBord ? hex : c.primaryBtn.border.color },
        },
      };
    });
  }

  const accent = lift(cfg.primary, dark);
  const priStyle = useMemo(() => primaryCss(cfg, dark), [cfg, dark]);
  const secStyle = useMemo(() => secondaryCss(cfg, dark), [cfg, dark]);

  // Contrast of the primary button text vs its worst stop.
  const contrastInfo = useMemo(() => {
    const p = cfg.primaryBtn;
    const stops = p.fill === "gradient" ? [p.gradFrom, p.gradTo] : [cfg.primary];
    const text = p.text === "auto" ? autoText(stops) : p.text === "light" ? "#ffffff" : "#1a1512";
    const worst = Math.min(...stops.map((h) => contrast(text, h)));
    return { worst, grade: worst >= 4.5 ? "aa" : worst >= 3 ? "large" : "fail" as "aa" | "large" | "fail" };
  }, [cfg]);

  async function save() { setBusy(true); try { await onSave?.(cfg); setSaved(cfg); } finally { setBusy(false); } }

  return (
    <div className="acs">
      <style>{ACS_CSS}</style>

      <div className="acs-head">
        <span className="acs-head-ic" style={priStyle.background ? { background: priStyle.background as string } : undefined}><Palette size={18} weight="fill" color={(priStyle.color as string) ?? "#fff"} /></span>
        <div>
          <h2 className="acs-title">Your app colour</h2>
          <p className="acs-sub">Make Sales Progressor yours. Set your colours, then design your buttons down to the detail. Glass cards and the status colours (green / amber / red) stay the same.</p>
        </div>
      </div>

      <div className="acs-frame">
        {/* ── Left: steps + controls ── */}
        <div className="acs-left">
          <div className="acs-pips">
            {STEPS.map((s) => (
              <button key={s.n} type="button" className={`acs-pip${step === s.n ? " on" : s.n < step ? " done" : ""}`} onClick={() => setStep(s.n)}>
                <span className="acs-pip-ic"><s.Icon size={15} weight="bold" /></span>
                <span className="acs-pip-tx">{s.label}<span>{s.sub}</span></span>
              </button>
            ))}
          </div>

          <div className="acs-body">
            {step === 1 && (
              <>
                <Grp label="Brand colours" hint="Primary & secondary">
                  <div className="acs-twocol">
                    <Swatch label="Primary" value={cfg.primary} onChange={setPrimary} />
                    <Swatch label="Secondary" value={cfg.secondary} onChange={(h) => setCfg((c) => ({ ...c, secondary: h }))} />
                  </div>
                  <p className="acs-note">Primary runs through buttons, links, focus and the ambient glow. Secondary is for the quieter, secondary actions.</p>
                  <div className="acs-suggest">
                    {SUGGESTED.map((s) => <button key={s} type="button" title={s} aria-label={`Primary ${s}`} className={`acs-dot${s.toLowerCase() === cfg.primary.toLowerCase() ? " on" : ""}`} style={{ background: s }} onClick={() => setPrimary(s)} />)}
                  </div>
                </Grp>
                <Grp label="Looks" hint="One-tap starting point">
                  <div className="acs-looks">
                    {LOOKS.map((l) => {
                      const bg = l.cfg.primaryBtn.fill === "gradient" ? `linear-gradient(${l.cfg.primaryBtn.angle}deg, ${l.cfg.primaryBtn.gradFrom}, ${l.cfg.primaryBtn.gradTo})` : l.cfg.primary;
                      const on = JSON.stringify(l.cfg) === JSON.stringify(cfg);
                      return (
                        <button key={l.name} type="button" className={`acs-look${on ? " on" : ""}`} onClick={() => setCfg(l.cfg)}>
                          <span className="acs-look-btn" style={{ background: bg, borderRadius: Math.min(l.cfg.shape.radius, 14), color: l.cfg.primaryBtn.text === "dark" ? "#1a1512" : "#fff" }}>Aa</span>
                          <span className="acs-look-n">{l.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Grp>
              </>
            )}

            {step === 2 && (
              <>
                <Grp label="Fill">
                  <Seg value={cfg.primaryBtn.fill} options={[{ v: "solid", label: "Solid" }, { v: "gradient", label: "Gradient" }]} onChange={(v) => patchPrimary({ fill: v })} />
                  {cfg.primaryBtn.fill === "gradient" ? (
                    <div className="acs-grad">
                      <div className="acs-grad-stops">
                        <Swatch label="From" value={cfg.primaryBtn.gradFrom} onChange={(h) => patchPrimary({ gradFrom: h })} small />
                        <span className="acs-arrow" aria-hidden>→</span>
                        <Swatch label="To" value={cfg.primaryBtn.gradTo} onChange={(h) => patchPrimary({ gradTo: h })} small />
                        <button type="button" className="acs-textlink" style={{ color: accent }} onClick={() => patchPrimary(autoGradient(cfg.primary))}>Match to primary</button>
                      </div>
                      <Slider label="Angle" min={0} max={360} step={5} value={cfg.primaryBtn.angle} suffix="°" onChange={(v) => patchPrimary({ angle: v })} accent={accent} />
                    </div>
                  ) : <p className="acs-note">A flat fill in your primary colour.</p>}
                </Grp>

                <Grp label="Text">
                  <div className="acs-inline">
                    <Seg value={cfg.primaryBtn.text} options={[{ v: "auto", label: "Auto" }, { v: "light", label: "White" }, { v: "dark", label: "Dark" }]} onChange={(v) => patchPrimary({ text: v })} />
                    <span className={`acs-contrast acs-contrast--${contrastInfo.grade}`} title={`Text contrast ${contrastInfo.worst.toFixed(1)}:1`}>
                      {contrastInfo.grade === "fail" ? <Warning size={13} weight="fill" /> : <Check size={13} weight="bold" />}
                      {contrastInfo.grade === "aa" ? "Good contrast" : contrastInfo.grade === "large" ? "OK on buttons" : "Low contrast"}
                    </span>
                  </div>
                </Grp>

                <Grp label="Shape & size" hint="Shared by all buttons">
                  <Slider label="Corner radius" min={0} max={30} value={cfg.shape.radius} onChange={(v) => patchShape({ radius: v })} accent={accent} />
                  <Slider label="Height" min={5} max={16} value={cfg.shape.padY} onChange={(v) => patchShape({ padY: v })} accent={accent} />
                  <Slider label="Width" min={10} max={40} value={cfg.shape.padX} onChange={(v) => patchShape({ padX: v })} accent={accent} />
                  <Slider label="Text size" min={11} max={18} value={cfg.shape.fontPx} onChange={(v) => patchShape({ fontPx: v })} accent={accent} />
                </Grp>

                <Grp label="Border">
                  <Toggle label="Add a border" on={cfg.primaryBtn.border.on} onChange={(v) => patchBorder({ on: v })} accent={accent} />
                  {cfg.primaryBtn.border.on && (
                    <div className="acs-borderrow">
                      <Swatch label="Colour" value={cfg.primaryBtn.border.color} onChange={(h) => patchBorder({ color: h })} small />
                      <Slider label="Width" min={1} max={4} value={cfg.primaryBtn.border.width} onChange={(v) => patchBorder({ width: v })} accent={accent} />
                    </div>
                  )}
                </Grp>

                <Grp label="Depth">
                  <Slider label="Shadow" min={0} max={100} value={cfg.primaryBtn.shadow} suffix="" onChange={(v) => patchPrimary({ shadow: v })} accent={accent} />
                </Grp>
              </>
            )}

            {step === 3 && (
              <>
                <Grp label="Style" hint="Uses your secondary colour">
                  <div className="acs-vcards">
                    {([["ghost", "Ghost"], ["soft", "Soft"], ["outline", "Outline"], ["filled", "Filled"]] as [SecondaryStyle, string][]).map(([v, l]) => (
                      <button key={v} type="button" className={`acs-vcard${cfg.secondaryBtn.style === v ? " on" : ""}`} onClick={() => setCfg((c) => ({ ...c, secondaryBtn: { style: v } }))}>
                        <span className="acs-vcard-btn" style={{ ...secondaryCss({ ...cfg, secondaryBtn: { style: v } }, false), padding: "5px 12px", fontSize: 11, borderRadius: Math.min(cfg.shape.radius, 12) }}>Button</span>
                        <span className="acs-vcard-l">{l}</span>
                      </button>
                    ))}
                  </div>
                </Grp>
                <Grp label="Secondary colour">
                  <Swatch label="Colour" value={cfg.secondary} onChange={(h) => setCfg((c) => ({ ...c, secondary: h }))} />
                  <p className="acs-note">Ghost stays neutral; Soft, Outline and Filled use this colour. Shape and size are shared with the primary button.</p>
                </Grp>
              </>
            )}
          </div>

          <div className="acs-foot">
            {step > 1 ? <button type="button" className="acs-nav" onClick={() => setStep((step - 1) as 1 | 2)}><ArrowLeft size={13} weight="bold" /> Back</button> : <span />}
            <div className="acs-foot-r">
              {step < 3 && <button type="button" className="acs-nav acs-nav--next" onClick={() => setStep((step + 1) as 2 | 3)}>Next <ArrowRight size={13} weight="bold" /></button>}
              <button type="button" className="acs-save" style={{ background: dirty ? (priStyle.background as string) : undefined, color: dirty ? (priStyle.color as string) : undefined }} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="acs-right">
          <div className="acs-pv-top">
            <span className="acs-eyebrow">Live preview</span>
            <Seg value={dark ? "dark" : "light"} options={[{ v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} onChange={(v) => setDark(v === "dark")} />
          </div>
          <div className={`acs-stage${dark ? " dark" : ""}`} style={{ ["--acc" as string]: accent, ["--accrgb" as string]: rgbStr(accent) }}>
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
                  <button type="button" className="acs-btn" style={{ ...priStyle, fontWeight: 650 }}>Confirm</button>
                  <button type="button" className="acs-btn" style={secStyle}>Snooze</button>
                  <a className="acs-link" href="#" onClick={(e) => e.preventDefault()}>View file</a>
                </div>
                <div className="acs-field">
                  <span className="acs-eyebrow" style={{ color: accent }}>Focus ring</span>
                  <input className="acs-input" defaultValue="example@agency.co.uk" />
                </div>
              </div>
            </div>
            <p className="acs-stage-note">Status pills (green / amber / red) and the glass card are fixed. Everything accent-coloured takes your colours.</p>
          </div>
          <button type="button" className="acs-reset" onClick={() => setCfg(DEFAULT_APP_COLOUR)}><ArrowCounterClockwise size={13} weight="bold" /> Reset to default</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles (self-contained; warm agent-app palette) ─────────────────────────────

const ACS_CSS = `
.acs{ --ink:#2d1810; --ink2:#5a3a28; --mut:rgba(45,24,16,0.55); --faint:rgba(45,24,16,0.4); --line:rgba(45,24,16,0.12); --paper:#ffffff;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--ink); max-width:1080px; margin:0 auto; }
.acs *{ box-sizing:border-box; }
.acs-eyebrow{ font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--faint); }

.acs-head{ display:flex; gap:14px; align-items:flex-start; margin-bottom:18px; }
.acs-head-ic{ width:40px; height:40px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; box-shadow:inset 0 1px 0 rgba(255,255,255,0.3); }
.acs-title{ margin:0 0 3px; font-size:19px; font-weight:800; letter-spacing:-0.02em; }
.acs-sub{ margin:0; font-size:13px; line-height:1.55; color:var(--ink2); max-width:66ch; }

.acs-frame{ display:grid; grid-template-columns:1fr 0.92fr; gap:20px; align-items:start; }
@media (max-width:900px){ .acs-frame{ grid-template-columns:1fr; } }

/* left */
.acs-left{ background:var(--paper); border:1px solid var(--line); border-radius:18px; overflow:hidden; box-shadow:0 1px 2px rgba(40,26,20,0.04); display:flex; flex-direction:column; }
.acs-pips{ display:flex; gap:2px; padding:10px; border-bottom:1px solid var(--line); background:rgba(45,24,16,0.015); }
.acs-pip{ flex:1; appearance:none; background:none; border:none; cursor:pointer; display:flex; align-items:center; gap:9px; padding:8px 9px; border-radius:11px; text-align:left; transition:background .14s; }
.acs-pip:hover{ background:rgba(45,24,16,0.04); }
.acs-pip.on{ background:rgba(var(--accrgb,255,107,74),0.1); }
.acs-pip-ic{ width:26px; height:26px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; background:rgba(45,24,16,0.06); color:var(--mut); }
.acs-pip.on .acs-pip-ic{ background:var(--ink); color:#fff; }
.acs-pip.done .acs-pip-ic{ background:rgba(31,138,74,0.14); color:#1f8a4a; }
.acs-pip-tx{ font-size:12.5px; font-weight:700; color:var(--ink); line-height:1.2; display:flex; flex-direction:column; min-width:0; }
.acs-pip-tx span{ font-size:10.5px; font-weight:500; color:var(--mut); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media (max-width:560px){ .acs-pip-tx span{ display:none; } }

.acs-body{ padding:16px; display:flex; flex-direction:column; gap:16px; min-height:290px; }

.acs-grp{ display:flex; flex-direction:column; gap:10px; }
.acs-grp-h{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.acs-grp-l{ font-size:12.5px; font-weight:750; letter-spacing:-0.01em; }
.acs-grp-hint{ font-size:11px; color:var(--faint); }
.acs-note{ margin:0; font-size:11px; line-height:1.5; color:var(--mut); }

.acs-twocol{ display:flex; gap:22px; flex-wrap:wrap; }
.acs-swatchrow{ display:flex; align-items:center; gap:11px; }
.acs-swatch{ position:relative; border-radius:10px; cursor:pointer; flex-shrink:0; border:0.5px solid rgba(0,0,0,0.14); box-shadow:inset 0 1px 0 rgba(255,255,255,0.35); }
.acs-swatch input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.acs-hexwrap{ display:flex; flex-direction:column; gap:4px; }
.acs-hex{ width:112px; padding:7px 9px; font:inherit; font-size:13px; font-family:ui-monospace,monospace; color:var(--ink); background:#fff; border:0.5px solid rgba(0,0,0,0.16); border-radius:8px; outline:none; }
.acs-hex:focus{ border-color:var(--ink2); }

.acs-suggest{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.acs-dot{ width:22px; height:22px; border-radius:6px; cursor:pointer; border:0.5px solid rgba(0,0,0,0.12); padding:0; transition:transform .12s; }
.acs-dot:hover{ transform:translateY(-1px); }
.acs-dot.on{ outline:2px solid var(--ink); outline-offset:1px; }

.acs-looks{ display:grid; grid-template-columns:repeat(4,1fr); gap:9px; }
@media (max-width:520px){ .acs-looks{ grid-template-columns:repeat(3,1fr); } }
.acs-look{ appearance:none; background:#fff; border:1px solid var(--line); border-radius:11px; padding:9px 7px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:7px; transition:transform .12s,border-color .14s,box-shadow .16s; }
.acs-look:hover{ transform:translateY(-2px); box-shadow:0 8px 18px -12px rgba(40,26,20,0.35); }
.acs-look.on{ border-color:var(--ink); }
.acs-look-btn{ width:42px; height:28px; display:grid; place-items:center; font-size:11px; font-weight:700; box-shadow:inset 0 1px 0 rgba(255,255,255,0.3); }
.acs-look-n{ font-size:10.5px; font-weight:650; color:var(--ink2); }

.acs-seg{ display:inline-flex; background:rgba(45,24,16,0.05); border-radius:9px; padding:3px; gap:2px; }
.acs-seg-btn{ appearance:none; border:none; background:none; font:inherit; font-size:12px; font-weight:600; color:var(--mut); padding:5px 12px; border-radius:7px; cursor:pointer; transition:background .14s,color .14s; }
.acs-seg-btn.on{ background:#fff; color:var(--ink); box-shadow:0 1px 2px rgba(40,26,20,0.12); }
.acs-inline{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

.acs-grad{ display:flex; flex-direction:column; gap:12px; margin-top:4px; }
.acs-grad-stops{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.acs-arrow{ color:var(--faint); font-weight:700; }
.acs-textlink{ appearance:none; background:none; border:none; font:inherit; font-size:11px; font-weight:700; cursor:pointer; margin-left:auto; }
.acs-textlink:hover{ text-decoration:underline; }
.acs-borderrow{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; }

.acs-srow{ display:grid; grid-template-columns:78px 1fr 42px; align-items:center; gap:10px; }
.acs-srow label{ font-size:12px; color:var(--ink2); }
.acs-srow input[type=range]{ width:100%; cursor:pointer; }
.acs-sval{ font-size:11.5px; font-weight:600; color:var(--mut); font-variant-numeric:tabular-nums; text-align:right; }

.acs-toggle{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.acs-toggle span{ font-size:12.5px; color:var(--ink); }
.acs-tg{ width:38px; height:22px; border-radius:999px; border:none; background:rgba(45,24,16,0.18); position:relative; cursor:pointer; transition:background .16s; flex-shrink:0; }
.acs-tg i{ position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.2); transition:transform .16s; }
.acs-tg.on i{ transform:translateX(16px); }

.acs-contrast{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:4px 9px; border-radius:999px; }
.acs-contrast--aa{ color:#1f8a4a; background:rgba(31,138,74,0.12); }
.acs-contrast--large{ color:#c97d1a; background:rgba(201,125,26,0.14); }
.acs-contrast--fail{ color:#c73e3e; background:rgba(199,62,62,0.12); }

.acs-vcards{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
@media (max-width:520px){ .acs-vcards{ grid-template-columns:repeat(2,1fr); } }
.acs-vcard{ appearance:none; background:#fff; border:1px solid var(--line); border-radius:11px; padding:12px 6px 8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px; transition:transform .12s,border-color .14s; }
.acs-vcard:hover{ transform:translateY(-2px); }
.acs-vcard.on{ border-color:var(--ink); }
.acs-vcard-btn{ font:inherit; font-weight:600; }
.acs-vcard-l{ font-size:11px; font-weight:650; color:var(--ink2); }

.acs-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-top:1px solid var(--line); background:rgba(45,24,16,0.015); }
.acs-foot-r{ display:flex; align-items:center; gap:10px; }
.acs-nav{ appearance:none; background:none; border:none; font:inherit; font-size:12.5px; font-weight:650; color:var(--ink2); cursor:pointer; display:inline-flex; align-items:center; gap:5px; padding:7px 10px; border-radius:9px; }
.acs-nav:hover{ background:rgba(45,24,16,0.05); }
.acs-nav--next{ background:rgba(45,24,16,0.06); }
.acs-save{ appearance:none; border:none; font:inherit; font-size:13px; font-weight:650; padding:9px 20px; border-radius:10px; cursor:pointer; background:rgba(45,24,16,0.14); color:rgba(45,24,16,0.4); box-shadow:inset 0 1px 0 rgba(255,255,255,0.25); }
.acs-save:disabled{ cursor:default; }

/* right / preview */
.acs-right{ position:sticky; top:16px; display:flex; flex-direction:column; gap:10px; }
.acs-pv-top{ display:flex; align-items:center; justify-content:space-between; }
.acs-stage{ border-radius:18px; padding:18px; background:radial-gradient(70% 60% at 85% 0%, rgba(var(--accrgb),0.10) 0%, rgba(var(--accrgb),0) 60%), linear-gradient(170deg,#faf8f6,#f1ece7); border:1px solid var(--line); }
.acs-stage.dark{ background:radial-gradient(70% 60% at 85% 0%, rgba(var(--accrgb),0.16) 0%, rgba(var(--accrgb),0) 60%), linear-gradient(170deg,#1a2230,#0e131d); border-color:rgba(255,255,255,0.08); color:#f3ede7; }
.acs-card{ border-radius:16px; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.55)); border:1px solid rgba(255,255,255,0.6); box-shadow:0 16px 40px -22px rgba(40,26,20,0.3); -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px); }
.acs-stage.dark .acs-card{ background:linear-gradient(180deg, rgba(30,41,59,0.8), rgba(20,28,44,0.74)); border-color:rgba(255,255,255,0.08); }
.acs-card-hdr{ padding:8px 15px; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--acc); background:rgba(var(--accrgb),0.08); border-bottom:1px solid rgba(var(--accrgb),0.14); }
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
.acs-btn{ appearance:none; font:inherit; cursor:pointer; font-weight:600; line-height:1; }
.acs-link{ font-size:12.5px; font-weight:650; color:var(--acc); text-decoration:none; }
.acs-link:hover{ text-decoration:underline; }
.acs-field{ margin-top:14px; display:flex; flex-direction:column; gap:5px; }
.acs-input{ font:inherit; font-size:12.5px; padding:8px 11px; border-radius:9px; border:1.5px solid rgba(var(--accrgb),0.55); background:rgba(255,255,255,0.7); color:var(--ink); outline:none; box-shadow:0 0 0 3px rgba(var(--accrgb),0.14); }
.acs-stage.dark .acs-input{ background:rgba(15,23,42,0.5); color:#f3ede7; }
.acs-stage-note{ margin:12px 2px 0; font-size:10.5px; line-height:1.5; color:var(--faint); }
.acs-stage.dark .acs-stage-note{ color:rgba(243,237,231,0.4); }
.acs-reset{ align-self:flex-start; appearance:none; background:none; border:none; font:inherit; font-size:12px; font-weight:600; color:var(--mut); cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.acs-reset:hover{ color:var(--ink2); }

@media (prefers-color-scheme: dark){
  .acs{ --ink:#f3ede7; --ink2:rgba(243,237,231,0.78); --mut:rgba(243,237,231,0.55); --faint:rgba(243,237,231,0.4); --line:rgba(255,255,255,0.1); --paper:rgba(255,255,255,0.04); }
  .acs-left{ box-shadow:none; }
  .acs-hex{ background:rgba(255,255,255,0.05); } .acs-seg,.acs-nav--next{ background:rgba(255,255,255,0.07); }
  .acs-seg-btn.on{ background:rgba(255,255,255,0.14); } .acs-look,.acs-vcard{ background:rgba(255,255,255,0.04); }
}
`;
