"use client";

// /dev/menus — a CONFIGURATOR for the little-menus / tooltips / popovers surface.
// Compose the surface (solid <-> glass, opacity, blur, saturation, border,
// shadow, radius) + pick the hover, and watch a live menu / tooltip / popover
// over busy content, in light AND dark (toggle top-right). Start from a preset,
// then curate until happy. When you land on one, read the values off the "chosen
// recipe" box and I'll make it the shared primitive.
//
// Look only — the portal/flip positioning primitive comes after the surface is
// signed off. Dev-only (local + staging; 404 on real production).

import { useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";

type Base = "solid" | "glass";
type Border = "none" | "hairline" | "visible";
type Shadow = "none" | "soft" | "deep";
type Hover = "tint" | "strong" | "lift" | "accent";
type Cfg = { base: Base; opacity: number; blur: number; saturate: number; border: Border; shadow: Shadow; radius: number; hover: Hover };

const PRESETS: { name: string; cfg: Cfg }[] = [
  { name: "Solid elevated", cfg: { base: "solid", opacity: 100, blur: 0, saturate: 100, border: "hairline", shadow: "soft", radius: 12, hover: "tint" } },
  { name: "Portal-header glass", cfg: { base: "glass", opacity: 62, blur: 24, saturate: 160, border: "hairline", shadow: "soft", radius: 12, hover: "tint" } },
  { name: "Light frost", cfg: { base: "glass", opacity: 70, blur: 12, saturate: 140, border: "hairline", shadow: "soft", radius: 12, hover: "tint" } },
  { name: "Heavy frost", cfg: { base: "glass", opacity: 55, blur: 48, saturate: 170, border: "hairline", shadow: "deep", radius: 14, hover: "tint" } },
  { name: "Crisp solid", cfg: { base: "solid", opacity: 100, blur: 0, saturate: 100, border: "visible", shadow: "deep", radius: 10, hover: "tint" } },
];

const SHADOW: Record<Shadow, string> = {
  none: "none",
  soft: "0 12px 30px rgba(20,12,6,0.16)",
  deep: "0 18px 46px rgba(0,0,0,0.32)",
};
const BORDER: Record<Border, string> = {
  none: "none",
  hairline: "0.5px solid var(--agent-border-subtle)",
  visible: "1px solid var(--agent-border-default)",
};

function surfaceStyle(c: Cfg): CSSProperties {
  const bd = c.base === "glass" ? `blur(${c.blur}px) saturate(${c.saturate}%)` : undefined;
  return {
    background: c.base === "solid" ? "var(--agent-surface-elevated)" : `rgba(var(--dm-glass-rgb), ${c.opacity / 100})`,
    backdropFilter: bd,
    WebkitBackdropFilter: bd,
    border: BORDER[c.border],
    boxShadow: SHADOW[c.shadow],
    borderRadius: c.radius,
  };
}

const ic = {
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  mail: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
};
function Svg({ d, size = 15 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

function Seg<T extends string>({ value, opts, onChange }: { value: T; opts: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="dm-seg">
      {opts.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}
function Slider({ label, value, min, max, step = 1, suffix = "", onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <label className={`dm-slider${disabled ? " off" : ""}`}>
      <span className="dm-ctl-lbl">{label}<b>{value}{suffix}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function DevMenusPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  const [c, setC] = useState<Cfg>(PRESETS[1].cfg);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => ({ ...p, [k]: v }));
  const surf = surfaceStyle(c);
  const isGlass = c.base === "glass";

  const recipe = isGlass
    ? `background: rgba(var(--glass-rgb), ${(c.opacity / 100).toFixed(2)});
backdrop-filter: blur(${c.blur}px) saturate(${c.saturate}%);
border: ${BORDER[c.border]};
box-shadow: ${SHADOW[c.shadow]};
border-radius: ${c.radius}px;   hover: ${c.hover}`
    : `background: var(--agent-surface-elevated);
border: ${BORDER[c.border]};
box-shadow: ${SHADOW[c.shadow]};
border-radius: ${c.radius}px;   hover: ${c.hover}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="dm-page">
        <div className="dm-head">
          <div>
            <h1 className="dm-h1">Little menus — build the surface</h1>
            <p className="dm-sub">Compose the one surface + hover we align every dropdown, tooltip and popover to. Start from a preset, tweak, toggle light/dark (top-right). The preview floats over busy content so you can judge blur and translucency exactly like it'll sit in the app.</p>
          </div>
          <ThemeModeToggle initialMode="light" />
        </div>

        <div className="dm-presets">
          <span className="dm-presets-lbl">Start from</span>
          {PRESETS.map((p) => (
            <button key={p.name} className="dm-preset" onClick={() => setC(p.cfg)}>{p.name}</button>
          ))}
        </div>

        <div className="dm-grid">
          {/* Controls */}
          <div className="dm-controls">
            <div className="dm-ctl-row"><span className="dm-ctl-lbl">Surface</span><Seg value={c.base} opts={[{ v: "solid", l: "Solid" }, { v: "glass", l: "Glass" }]} onChange={(v) => set("base", v)} /></div>
            <Slider label="Opacity" value={c.opacity} min={30} max={100} suffix="%" onChange={(n) => set("opacity", n)} disabled={!isGlass} />
            <Slider label="Blur" value={c.blur} min={0} max={60} suffix="px" onChange={(n) => set("blur", n)} disabled={!isGlass} />
            <Slider label="Saturation" value={c.saturate} min={100} max={200} suffix="%" onChange={(n) => set("saturate", n)} disabled={!isGlass} />
            <div className="dm-ctl-row"><span className="dm-ctl-lbl">Border</span><Seg value={c.border} opts={[{ v: "none", l: "None" }, { v: "hairline", l: "Hairline" }, { v: "visible", l: "Visible" }]} onChange={(v) => set("border", v)} /></div>
            <div className="dm-ctl-row"><span className="dm-ctl-lbl">Shadow</span><Seg value={c.shadow} opts={[{ v: "none", l: "None" }, { v: "soft", l: "Soft" }, { v: "deep", l: "Deep" }]} onChange={(v) => set("shadow", v)} /></div>
            <Slider label="Radius" value={c.radius} min={6} max={18} suffix="px" onChange={(n) => set("radius", n)} />
            <div className="dm-ctl-row"><span className="dm-ctl-lbl">Hover</span><Seg value={c.hover} opts={[{ v: "tint", l: "Tint" }, { v: "strong", l: "Strong" }, { v: "lift", l: "Lift" }, { v: "accent", l: "Accent" }]} onChange={(v) => set("hover", v)} /></div>

            <div className="dm-recipe">
              <div className="dm-ctl-lbl" style={{ marginBottom: 7 }}>Chosen recipe</div>
              <pre>{recipe}</pre>
            </div>
          </div>

          {/* Live preview over busy content */}
          <div className="dm-stage">
            <div className="dm-behind">
              <div className="dm-photo" />
              <div className="dm-lines"><span /><span /><span /><span className="short" /></div>
              <div className="dm-photo alt" />
              <div className="dm-lines"><span /><span className="short" /><span /></div>
            </div>
            <div className="dm-float">
              <div className={`dm-menu hv-${c.hover}`} style={surf} role="menu">
                <button className="dm-mi"><Svg d={ic.note} /> Add an update</button>
                <button className="dm-mi"><Svg d={ic.clock} /> Reschedule</button>
                <button className="dm-mi"><Svg d={ic.check} /> Mark done</button>
                <div className="dm-mdiv" />
                <button className="dm-mi"><Svg d={ic.trash} /> Remove</button>
              </div>
              <div className="dm-tip" style={surf} role="tooltip">
                <div className="dm-tip-h"><Svg d={ic.mail} size={12} /> Email</div>
                <div className="dm-tip-s">Auto · Logged</div>
                <div className="dm-tip-w">16 Oct 2026, 20:05</div>
              </div>
              <div className="dm-pop" style={surf}>
                <div className="dm-lab">New date</div>
                <input className="dm-in" type="date" defaultValue="2026-10-30" />
                <div className="dm-lab" style={{ marginTop: 10 }}>Update</div>
                <input className="dm-in" placeholder="What's happened?" />
                <div className="dm-prow"><button className="dm-btn">Cancel</button><button className="dm-btn primary">Save</button></div>
              </div>
            </div>
          </div>
        </div>

        <p className="dm-foot">Curate here as long as you like — nothing's committed to the look until you say. When one feels right, tell me (the recipe box has the exact values) and I'll build it into the single shared primitive, then wire the positioning and migrate every menu onto it.</p>
      </div>
    </>
  );
}

const CSS = `
.dm-page { position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:36px 26px 110px; color:var(--agent-text-primary); font-family:var(--font-geist-sans, system-ui, sans-serif); }
.dm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.dm-h1 { font-size:25px; font-weight:760; letter-spacing:-0.02em; margin:0; color:var(--agent-text-primary); }
.dm-sub { font-size:13.5px; color:var(--agent-text-muted); margin:9px 0 0; max-width:70ch; line-height:1.55; }

.dm-presets { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:22px; }
.dm-presets-lbl { font-size:11px; font-weight:750; letter-spacing:0.06em; text-transform:uppercase; color:var(--agent-text-faint,#b8a894); margin-right:4px; }
.dm-preset { font-family:inherit; font-size:12.5px; font-weight:600; padding:7px 14px; border-radius:999px; cursor:pointer; border:0.5px solid var(--agent-border-default); background:var(--agent-surface-elevated); color:var(--agent-text-secondary); transition:border-color .12s, color .12s; }
.dm-preset:hover { border-color:var(--agent-coral); color:var(--agent-text-primary); }

.dm-grid { display:grid; grid-template-columns:300px 1fr; gap:26px; margin-top:26px; align-items:start; }
@media (max-width:860px){ .dm-grid { grid-template-columns:1fr; } }

.dm-controls { display:flex; flex-direction:column; gap:15px; padding:18px; border-radius:14px; background:var(--agent-surface-elevated); border:0.5px solid var(--agent-border-subtle); box-shadow:0 8px 22px -14px rgba(20,12,6,0.3); }
.dm-ctl-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.dm-ctl-lbl { font-size:12px; font-weight:650; color:var(--agent-text-secondary); display:flex; justify-content:space-between; width:100%; }
.dm-ctl-lbl b { color:var(--agent-text-primary); font-variant-numeric:tabular-nums; font-weight:700; }
.dm-ctl-row > .dm-ctl-lbl { width:auto; }
.dm-slider { display:flex; flex-direction:column; gap:6px; }
.dm-slider.off { opacity:.4; pointer-events:none; }
.dm-slider input { width:100%; accent-color:var(--agent-coral); }
.dm-seg { display:inline-flex; background:var(--agent-surface-subtle, rgba(0,0,0,0.04)); border-radius:9px; padding:3px; gap:2px; }
.dm-seg button { font-family:inherit; font-size:11.5px; font-weight:600; padding:5px 10px; border-radius:7px; border:none; background:none; color:var(--agent-text-muted); cursor:pointer; }
.dm-seg button.on { background:var(--agent-surface-elevated); color:var(--agent-text-primary); box-shadow:0 1px 3px rgba(0,0,0,0.12); }

.dm-recipe { margin-top:4px; padding-top:14px; border-top:1px solid var(--agent-border-subtle); }
.dm-recipe pre { margin:0; font-family:ui-monospace, "SF Mono", Menlo, monospace; font-size:11px; line-height:1.6; color:var(--agent-text-secondary); white-space:pre-wrap; }

/* Stage: busy content behind so blur/translucency is judgeable. */
.dm-stage { --dm-glass-rgb:255,255,255; --dm-ink-rgb:45,24,16; position:relative; min-height:420px; border-radius:16px; overflow:hidden; border:0.5px solid var(--agent-border-subtle); }
:root[data-theme="dark"] .dm-stage { --dm-glass-rgb:20,26,36; --dm-ink-rgb:235,235,240; }
.dm-behind { position:absolute; inset:0; padding:22px; display:grid; grid-template-columns:120px 1fr; gap:18px 22px; align-content:start; }
.dm-photo { width:120px; height:92px; border-radius:12px; background:linear-gradient(135deg,#7aa6d8,#c98a6a 60%,#e0b44a); }
.dm-photo.alt { background:linear-gradient(135deg,#6fbf9a,#4a79c9 70%,#8a5ad8); }
.dm-lines { display:flex; flex-direction:column; gap:9px; padding-top:6px; }
.dm-lines span { height:11px; border-radius:6px; background:var(--agent-text-primary); opacity:0.16; }
.dm-lines span.short { width:52%; }
.dm-float { position:relative; z-index:2; display:flex; gap:22px; flex-wrap:wrap; padding:26px; justify-content:center; }

.dm-menu { width:212px; padding:6px; height:max-content; }
.dm-mi { display:flex; align-items:center; gap:10px; width:100%; padding:9px 11px; border:none; background:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:550; text-align:left; color:var(--agent-text-secondary); transition:background .12s, color .12s, transform .12s, box-shadow .12s; }
.dm-mi > svg { color:var(--agent-text-muted); flex-shrink:0; }
.hv-tint .dm-mi:hover { background:var(--agent-coral-bg-tint, rgba(255,107,74,0.09)); color:var(--agent-text-primary); }
.hv-tint .dm-mi:hover > svg { color:var(--agent-coral-deep,#f0471e); }
.hv-strong .dm-mi:hover { background:rgba(var(--agent-coral-rgb,255,107,74),0.18); color:var(--agent-text-primary); }
.hv-strong .dm-mi:hover > svg { color:var(--agent-coral-deep,#f0471e); }
.hv-lift .dm-mi:hover { background:rgba(var(--dm-ink-rgb,45,24,16),0.06); color:var(--agent-text-primary); transform:translateY(-1px); box-shadow:0 5px 14px -4px rgba(0,0,0,0.3); }
.hv-accent .dm-mi { box-shadow:inset 2px 0 0 transparent; border-radius:6px; }
.hv-accent .dm-mi:hover { background:var(--agent-coral-bg-tint, rgba(255,107,74,0.07)); box-shadow:inset 2px 0 0 var(--agent-coral); color:var(--agent-text-primary); }
.dm-mdiv { height:1px; background:var(--agent-border-subtle); margin:5px 8px; }

.dm-tip { width:210px; padding:11px 13px; height:max-content; }
.dm-tip-h { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--agent-text-muted); margin-bottom:6px; }
.dm-tip-s { font-size:13.5px; font-weight:720; color:var(--agent-text-primary); }
.dm-tip-w { font-size:11.5px; color:var(--agent-text-muted); margin-top:2px; font-variant-numeric:tabular-nums; }

.dm-pop { width:240px; padding:13px; height:max-content; }
.dm-lab { font-size:10px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; color:var(--agent-text-muted); margin-bottom:5px; }
.dm-in { width:100%; box-sizing:border-box; font-family:inherit; font-size:12px; padding:7px 9px; border-radius:8px; border:0.5px solid var(--agent-border-default); background:var(--agent-surface-glass,#fff); color:var(--agent-text-primary); }
.dm-prow { display:flex; gap:6px; justify-content:flex-end; margin-top:12px; }
.dm-btn { font-family:inherit; font-size:12px; font-weight:650; padding:6px 13px; border-radius:9px; cursor:pointer; border:0.5px solid var(--agent-border-default); background:transparent; color:var(--agent-text-secondary); }
.dm-btn.primary { background:var(--agent-coral); border-color:transparent; color:#fff; }

.dm-foot { margin-top:30px; padding-top:18px; border-top:2px solid var(--agent-coral); font-size:13px; color:var(--agent-text-muted); line-height:1.55; max-width:76ch; }
`;
