"use client";
// Shell Glass Lab · Ellis-only, desktop-only live tuner for the EXPERIMENTAL
// shell's chrome glass (floating capsule / left drawer / compact bar). Lets Ellis
// pick any of the real /dev "set ways of doing glass" (across the LiquidGlass
// canvas, LiquidLens slab, and CSS material engines), fine-tune it live via
// useShellGlass(), and copy a readable settings block to tell us what to bake
// into AgentShellExperimental.tsx. Save = persist the personal preview (localStorage),
// NOT an app-wide bake. Mirrors the Design Lab drawer's look. 2026-11-12.

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Blend, X, RotateCcw, Copy, Check } from "lucide-react";
import { useDarkMode } from "@/lib/agent/use-theme";
import {
  useShellGlass,
  SHELL_GLASS_MATERIALS,
  SHELL_GLASS_DEFAULTS,
  engineOf,
  type ShellGlassEngine,
  type ShellGlassSettings,
} from "@/lib/agent/shell-glass";

// ── rgba helpers (tint = colour + alpha; alpha is the "fade") ──────────────────
function parseRgba(s: string): { r: number; g: number; b: number; a: number } {
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i);
  if (!m) return { r: 255, g: 255, b: 255, a: 0.6 };
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
}
function composeRgba(r: number, g: number, b: number, a: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.max(0, Math.min(1, a)).toFixed(2)})`;
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const ENGINE_LABEL: Record<ShellGlassEngine, string> = {
  canvas: "Liquid Glass · canvas",
  lens: "Slab lens · SVG",
  css: "CSS material",
};

// The exact block Ellis copies to us · engine-aware, names the bake target.
function exportText(s: ShellGlassSettings): string {
  const engine = engineOf(s.material);
  const def = SHELL_GLASS_MATERIALS.find((m) => m.id === s.material);
  const radiusNote = `radius ×${s.radiusScale} (cap/compact 19 → ${Math.round(19 * s.radiusScale)}, drawer 24 → ${Math.round(24 * s.radiusScale)}, panel 20 → ${Math.round(20 * s.radiusScale)})`;
  const head = [
    "Shell Glass Lab · experimental shell",
    `Material: ${def?.label ?? s.material}  (engine: ${ENGINE_LABEL[engine]})`,
    "Bake into components/layout/AgentShellExperimental.tsx (AgxGlass):",
    "",
  ];
  let body: string[];
  if (engine === "canvas") {
    body = [
      `  <LiquidGlass blur={${s.blur}} displace={${s.displace}} thickness={${s.thickness}} aberration={${s.aberration}} />`,
      `  ${radiusNote}`,
      `  tint light: "${s.tintLight}"`,
      `  tint dark:  "${s.tintDark}"`,
      `  frost fallback blur: ${s.frostBlur}px`,
    ];
  } else if (engine === "lens") {
    body = [
      `  Switch AgxGlass to <LiquidLens>:`,
      `  <LiquidLens strength="${s.lensStrength}" thickness={${s.lensThickness}}${s.lensDisplacement ? ` displacement={${s.lensDisplacement}}` : ""}${s.lensBlur ? ` blur={${s.lensBlur}}` : ""} />`,
      `  ${radiusNote}`,
      `  tint light: "${s.tintLight}"`,
      `  tint dark:  "${s.tintDark}"`,
    ];
  } else {
    body = [
      `  Render a CSS-material div: className "agx-mat agx-mat-${s.material.slice(4)}"`,
      `  (fixed recipe in app/agent/styles/shell-experimental.css · foundry ${s.material.slice(4)})`,
      `  ${radiusNote}`,
    ];
  }
  return [...head, ...body].join("\n");
}

export function ShellGlassLabToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Shell Glass Lab (Ellis only)"
        aria-label="Open Shell Glass Lab"
        data-shell-glass-lab
        className="agent-chip-hover"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "#5b8cff", cursor: "pointer" }}
      >
        <Blend size={15} />
      </button>
      <ShellGlassLabDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ShellGlassLabDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, patch, applyMaterial, reset } = useShellGlass();
  const { isDark } = useDarkMode();
  const [copied, setCopied] = useState(false);
  const engine = engineOf(settings.material);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    const text = exportText(settings);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shell-glass.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [settings]);

  const c = isDark
    ? { panel: "#111621", rowBg: "#171c27", text: "#e8edf5", sub: "#9aa7b8", faint: "#6b7280", border: "rgba(255,255,255,0.10)", borderOn: "rgba(91,140,255,0.50)", chip: "#1b2130", input: "#0e131c", headerGrad: "linear-gradient(180deg, rgba(91,140,255,0.10), transparent)" }
    : { panel: "#ffffff", rowBg: "#fbfbfc", text: "#0f172a", sub: "#64748b", faint: "#94a3b8", border: "rgba(15,23,42,0.08)", borderOn: "rgba(91,140,255,0.30)", chip: "#ffffff", input: "#ffffff", headerGrad: "linear-gradient(180deg, rgba(91,140,255,0.04), transparent)" };

  const isDefault = (Object.keys(SHELL_GLASS_DEFAULTS) as (keyof ShellGlassSettings)[]).every((k) => settings[k] === SHELL_GLASS_DEFAULTS[k]);
  const engines: ShellGlassEngine[] = ["canvas", "lens", "css"];

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{`@keyframes shell-glass-lab-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      <aside
        role="dialog"
        aria-label="Shell Glass Lab"
        data-shell-glass-lab
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 390, maxWidth: "100vw", background: c.panel, borderLeft: `1px solid ${c.border}`, boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", zIndex: 9999, display: "flex", flexDirection: "column", animation: "shell-glass-lab-in 220ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px", borderBottom: `0.5px solid ${c.border}`, background: c.headerGrad }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#5b8cff", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shell Glass Lab</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: c.text }}>Experimental shell glass</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.sub }}>Capsule · left drawer · compact bar · desktop only</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: `1px solid ${c.border}`, background: c.chip, color: c.sub, cursor: "pointer", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
          {/* Material picker · grouped by engine (the real /dev "set ways") */}
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: "0.06em" }}>Material</p>
          {engines.map((eng) => (
            <div key={eng} style={{ marginBottom: 10 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: c.faint, letterSpacing: "0.04em" }}>{ENGINE_LABEL[eng]}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SHELL_GLASS_MATERIALS.filter((m) => m.engine === eng).map((m) => {
                  const on = settings.material === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => applyMaterial(m.id)} title={m.note}
                      style={{ padding: "6px 11px", fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? c.borderOn : c.border}`, background: on ? "rgba(91,140,255,0.12)" : c.chip, color: on ? "#5b8cff" : c.text }}>
                      {m.label.replace(/^.*· /, "")}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p style={{ margin: "2px 0 16px", fontSize: 10.5, color: c.faint, fontStyle: "italic" }}>Open the left drawer (edge handle) to see the nav surface update too.</p>

          {/* Engine-specific knobs */}
          <div style={{ paddingTop: 12, borderTop: `0.5px solid ${c.border}` }}>
            {engine === "canvas" && (<>
              <Slider c={c} label="Blur (residual frost)" value={settings.blur} min={0} max={24} step={0.5} onChange={(v) => patch({ blur: v })} fmt={(v) => `${v}px`} />
              <Slider c={c} label="Displacement (bend)" value={settings.displace} min={0} max={140} step={1} onChange={(v) => patch({ displace: v })} fmt={(v) => `${Math.round(v)}`} />
              <Slider c={c} label="Rim thickness" value={settings.thickness} min={2} max={48} step={1} onChange={(v) => patch({ thickness: v })} fmt={(v) => `${Math.round(v)}px`} />
              <Slider c={c} label="Chromatic aberration" value={settings.aberration} min={0} max={24} step={1} onChange={(v) => patch({ aberration: v })} fmt={(v) => (v === 0 ? "off" : `${Math.round(v)}px`)} />
            </>)}

            {engine === "lens" && (<>
              <Seg c={c} label="Strength" value={settings.lensStrength} options={[{ v: "soft", label: "Soft" }, { v: "strong", label: "Strong" }]} onChange={(v) => patch({ lensStrength: v })} />
              <Slider c={c} label="Lens thickness (rim)" value={settings.lensThickness} min={0.1} max={4} step={0.1} onChange={(v) => patch({ lensThickness: v })} fmt={(v) => `${v.toFixed(1)}×`} />
              <Slider c={c} label="Displacement override" value={settings.lensDisplacement} min={0} max={180} step={1} onChange={(v) => patch({ lensDisplacement: v })} fmt={(v) => (v === 0 ? "auto" : `${Math.round(v)}`)} />
              <Slider c={c} label="Lens blur" value={settings.lensBlur} min={0} max={12} step={0.5} onChange={(v) => patch({ lensBlur: v })} fmt={(v) => (v === 0 ? "off" : `${v}px`)} />
            </>)}

            {engine === "css" && (
              <p style={{ margin: "0 0 4px", fontSize: 11.5, color: c.sub, lineHeight: 1.5 }}>
                This is a <b style={{ color: c.text }}>fixed CSS recipe</b> · its blur, tint and rim are baked into the stylesheet. Only corner radius applies. Switch to a Liquid Glass or Slab lens material to tune blur, tint &amp; fade.
              </p>
            )}

            <Slider c={c} label="Corner radius" value={settings.radiusScale} min={0.3} max={2} step={0.05} onChange={(v) => patch({ radiusScale: v })} fmt={(v) => `${v.toFixed(2)}×`} />
          </div>

          {/* Tint & fade · canvas + lens only */}
          {engine !== "css" && (
            <div style={{ margin: "6px 0 2px", paddingTop: 12, borderTop: `0.5px solid ${c.border}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#5b8cff", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tint &amp; fade</p>
              <TintRow c={c} label="☀ Light theme" value={settings.tintLight} onChange={(v) => patch({ tintLight: v })} />
              <TintRow c={c} label="🌙 Dark theme" value={settings.tintDark} onChange={(v) => patch({ tintDark: v })} />
              <p style={{ margin: "2px 0 0", fontSize: 10.5, color: c.faint, fontStyle: "italic" }}>You&rsquo;re previewing <b style={{ color: c.sub }}>{isDark ? "dark" : "light"}</b>. Flip the theme to see the other.</p>
            </div>
          )}

          {/* Fallback (secondary) · canvas + lens */}
          {engine !== "css" && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 11, fontWeight: 600, color: c.sub, cursor: "pointer", padding: "6px 2px" }}>Frosted fallback (Safari / Firefox / iOS)</summary>
              <div style={{ padding: "8px 2px 2px" }}>
                <Slider c={c} label="Fallback blur" value={settings.frostBlur} min={0} max={80} step={1} onChange={(v) => patch({ frostBlur: v })} fmt={(v) => `${Math.round(v)}px`} />
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <footer style={{ padding: "12px 16px", borderTop: `0.5px solid ${c.border}`, display: "flex", gap: 8, background: c.rowBg }}>
          <button onClick={reset} disabled={isDefault} title="Back to the shipped look" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", fontSize: 12, fontWeight: 500, borderRadius: 8, border: `0.5px solid ${c.border}`, background: c.chip, color: isDefault ? c.faint : c.text, cursor: isDefault ? "not-allowed" : "pointer" }}>
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={handleCopy} style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid #5b8cff", background: "#5b8cff", color: "#fff", cursor: "pointer" }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied, send it to me" : "Copy settings"}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function Slider({ c, label, value, min, max, step, onChange, fmt }: {
  c: Record<string, string>; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ color: c.text, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#5b8cff", cursor: "pointer" }} />
    </div>
  );
}

function Seg<T extends string>({ c, label, value, options, onChange }: {
  c: Record<string, string>; label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 9, background: c.rowBg, border: `0.5px solid ${c.border}` }}>
        {options.map((o) => {
          const on = value === o.v;
          return (
            <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{ flex: 1, padding: "6px 4px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: on ? "#5b8cff" : "transparent", color: on ? "#fff" : c.sub }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TintRow({ c, label, value, onChange }: {
  c: Record<string, string>; label: string; value: string; onChange: (v: string) => void;
}) {
  const { r, g, b, a } = parseRgba(value);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ color: c.text, fontVariantNumeric: "tabular-nums" }}>{Math.round(a * 100)}% fade</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ position: "relative", width: 30, height: 30, borderRadius: 7, flexShrink: 0, cursor: "pointer", overflow: "hidden", border: `1px solid ${c.border}`, background: `rgb(${r}, ${g}, ${b})` }}>
          <input type="color" value={rgbToHex(r, g, b)} onChange={(e) => { const n = hexToRgb(e.target.value); onChange(composeRgba(n.r, n.g, n.b, a)); }} style={{ position: "absolute", inset: -4, width: "150%", height: "150%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
        </label>
        <input type="range" min={0} max={1} step={0.01} value={a} onChange={(e) => onChange(composeRgba(r, g, b, parseFloat(e.target.value)))} style={{ flex: 1, accentColor: "#5b8cff", cursor: "pointer" }} />
      </div>
    </div>
  );
}
