"use client";

// /dev/toast-lab — full re-think tool for the agent toast. Every axis is an
// independent control: surface MATERIAL, LAYOUT (composition), ACCENT treatment,
// the TIMER indicator (the "loading bar" and alternatives), SHAPE, MOTION (replay
// the enter animation), and STACKING (separate vs a collapsed pile that expands on
// hover). Renders the real toast content over a busy backdrop so glass refracts.
// Dev-only, nothing wired — copy the winning combo into .agent-toast afterwards.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CheckCircle, Info, Warning, WarningCircle, X } from "@phosphor-icons/react";

type ToastType = "success" | "info" | "warning" | "error";
const ACCENT: Record<ToastType, string> = { success: "var(--agent-success)", info: "var(--agent-info)", warning: "var(--agent-warning)", error: "var(--agent-danger)" };
const ICONBG: Record<ToastType, string> = { success: "rgba(31,138,74,0.14)", info: "rgba(61,122,184,0.14)", warning: "rgba(201,125,26,0.14)", error: "rgba(199,62,62,0.14)" };
const ICONS: Record<ToastType, React.ElementType> = { success: CheckCircle, info: Info, warning: Warning, error: WarningCircle };
const COPY: Record<ToastType, { t: string; d: string }> = {
  success: { t: "Booking confirmed", d: "We've let the client and the seller know." },
  info: { t: "Draft saved", d: "Your changes are safe." },
  warning: { t: "Check the exchange date", d: "It falls on a weekend." },
  error: { t: "Couldn't send the email", d: "Check the address and try again." },
};

// ── Surface materials ───────────────────────────────────────────────────────
type Overrides = { blur?: number; opacity?: number };
type Built = { container: CSSProperties; ink: string; subInk: string; layers?: ReactNode; wrapper?: CSSProperties };
type Material = { key: string; name: string; build: (dark: boolean, o: Overrides) => Built };
const LI = { ink: "rgba(28,20,16,0.92)", subInk: "rgba(28,20,16,0.6)" };
const DI = { ink: "rgba(255,251,245,0.96)", subInk: "rgba(255,251,245,0.66)" };
const sheen = (s: number): ReactNode => <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: `linear-gradient(180deg, rgba(255,255,255,${s}) 0%, rgba(255,255,255,0) 42%)` }} />;

const MATERIALS: Material[] = [
  { key: "current", name: "Current (shipped)", build: (d, o) => ({ ...(d ? DI : LI), container: { background: d ? `rgba(30,27,34,${o.opacity ?? 0.86})` : `rgba(255,255,255,${o.opacity ?? 0.88})`, backdropFilter: `blur(${o.blur ?? 24}px) saturate(180%)`, WebkitBackdropFilter: `blur(${o.blur ?? 24}px) saturate(180%)`, border: `0.5px solid ${d ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)"}`, boxShadow: "0 8px 32px rgba(40,24,16,0.12), 0 0 0 0.5px rgba(255,255,255,0.4) inset" } }) },
  { key: "apple2026", name: "Apple Glass 2026", build: (d, o) => ({ ...(d ? DI : LI), layers: <>{sheen(d ? 0.16 : 0.5)}<span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", boxShadow: `0 1px 0 ${d ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.75)"} inset` }} /></>, container: { background: d ? `rgba(44,40,52,${o.opacity ?? 0.42})` : `rgba(255,255,255,${o.opacity ?? 0.5})`, backdropFilter: `blur(${o.blur ?? 30}px) saturate(200%) brightness(${d ? 1.1 : 1.06})`, WebkitBackdropFilter: `blur(${o.blur ?? 30}px) saturate(200%) brightness(${d ? 1.1 : 1.06})`, border: `0.5px solid ${d ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)"}`, boxShadow: "0 12px 44px rgba(40,24,16,0.18), 0 2px 10px rgba(40,24,16,0.08), 0 0 0 0.5px rgba(255,255,255,0.35) inset" } }) },
  { key: "liquid", name: "Liquid morph", build: (d, o) => ({ ...(d ? DI : LI), layers: <><span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: `radial-gradient(130% 100% at 12% -10%, rgba(255,255,255,${d ? 0.26 : 0.62}) 0%, rgba(255,255,255,0) 52%)` }} /><span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: `radial-gradient(120% 90% at 90% 120%, rgba(0,0,0,${d ? 0.22 : 0.08}) 0%, rgba(0,0,0,0) 55%)` }} /></>, container: { background: d ? `rgba(40,36,48,${o.opacity ?? 0.4})` : `rgba(255,255,255,${o.opacity ?? 0.44})`, backdropFilter: `blur(${o.blur ?? 34}px) saturate(190%)`, WebkitBackdropFilter: `blur(${o.blur ?? 34}px) saturate(190%)`, border: `0.5px solid ${d ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)"}`, boxShadow: "0 16px 50px rgba(40,24,16,0.2), 0 0 0 0.5px rgba(255,255,255,0.3) inset, 0 -8px 20px rgba(40,24,16,0.06) inset" } }) },
  { key: "specular", name: "Specular sweep", build: (d, o) => ({ ...(d ? DI : LI), layers: <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: `linear-gradient(115deg, rgba(255,255,255,0) 28%, rgba(255,255,255,${d ? 0.16 : 0.4}) 46%, rgba(255,255,255,0) 62%)` }} />, container: { background: d ? `rgba(32,28,38,${o.opacity ?? 0.5})` : `rgba(255,255,255,${o.opacity ?? 0.52})`, backdropFilter: `blur(${o.blur ?? 26}px) saturate(185%)`, WebkitBackdropFilter: `blur(${o.blur ?? 26}px) saturate(185%)`, border: `0.5px solid ${d ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)"}`, boxShadow: "0 10px 36px rgba(40,24,16,0.14)" } }) },
  { key: "tinted", name: "Tinted (accent)", build: (d, o) => ({ ...(d ? DI : LI), container: { background: d ? `rgba(34,30,40,${o.opacity ?? 0.5})` : `rgba(255,255,255,${o.opacity ?? 0.5})`, backdropFilter: `blur(${o.blur ?? 24}px) saturate(200%)`, WebkitBackdropFilter: `blur(${o.blur ?? 24}px) saturate(200%)`, border: "0.5px solid color-mix(in srgb, var(--toast-accent) 40%, transparent)", boxShadow: "0 10px 34px rgba(40,24,16,0.14), 0 0 0 0.5px color-mix(in srgb, var(--toast-accent) 22%, transparent) inset" } }) },
  { key: "deepFrost", name: "Deep frost", build: (d, o) => ({ ...(d ? DI : LI), container: { background: d ? `rgba(28,25,32,${o.opacity ?? 0.34})` : `rgba(255,255,255,${o.opacity ?? 0.4})`, backdropFilter: `blur(${o.blur ?? 42}px) saturate(210%)`, WebkitBackdropFilter: `blur(${o.blur ?? 42}px) saturate(210%)`, border: `0.5px solid ${d ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.45)"}`, boxShadow: "0 10px 40px rgba(40,24,16,0.14)" } }) },
  { key: "clear", name: "Ultra-thin", build: (d, o) => ({ ...(d ? DI : LI), container: { background: d ? `rgba(26,24,30,${o.opacity ?? 0.3})` : `rgba(255,255,255,${o.opacity ?? 0.3})`, backdropFilter: `blur(${o.blur ?? 12}px) saturate(160%)`, WebkitBackdropFilter: `blur(${o.blur ?? 12}px) saturate(160%)`, border: `0.5px solid ${d ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.4)"}`, boxShadow: "0 6px 20px rgba(40,24,16,0.1)" } }) },
  { key: "vibrantDark", name: "Vibrant dark", build: (_d, o) => ({ ...DI, layers: sheen(0.14), container: { background: `rgba(16,14,20,${o.opacity ?? 0.55})`, backdropFilter: `blur(${o.blur ?? 28}px) saturate(200%)`, WebkitBackdropFilter: `blur(${o.blur ?? 28}px) saturate(200%)`, border: "0.5px solid rgba(255,255,255,0.14)", borderTopColor: "rgba(255,255,255,0.26)", boxShadow: "0 14px 44px rgba(0,0,0,0.4), 0 0 24px color-mix(in srgb, var(--toast-accent) 18%, transparent)" } }) },
  { key: "solid", name: "Solid elevated", build: (d, _o) => ({ ...(d ? DI : LI), container: { background: d ? "#201d26" : "#ffffff", backdropFilter: "none", WebkitBackdropFilter: "none", border: `0.5px solid ${d ? "rgba(255,255,255,0.08)" : "rgba(40,24,16,0.08)"}`, boxShadow: "0 12px 40px rgba(40,24,16,0.18), 0 2px 6px rgba(40,24,16,0.08)" } }) },
  // ── Glass Foundry treatments (ported from /dev/glass-foundry, the pure-CSS trio).
  //    V0/V1 there are the real SVG-displacement engine — too heavy for a toast, not ported.
  { key: "gfFrost", name: "V2 · Frosted vibrancy", build: (d, o) => ({ ...(d ? DI : LI), layers: <span aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: "40%", borderRadius: "inherit", pointerEvents: "none", background: "linear-gradient(180deg,rgba(255,255,255,0.14),transparent)" }} />, container: { background: d ? `rgba(28,33,46,${o.opacity ?? 0.56})` : `rgba(255,255,255,${o.opacity ?? 0.58})`, backdropFilter: `blur(${o.blur ?? 28}px) saturate(150%)`, WebkitBackdropFilter: `blur(${o.blur ?? 28}px) saturate(150%)`, border: `1px solid ${d ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.8)"}`, boxShadow: d ? "0 1px 0 rgba(255,255,255,0.3) inset, 0 18px 40px rgba(0,0,0,0.34)" : "0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 38px rgba(20,30,60,0.14)" } }) },
  { key: "gfClear", name: "V3 · Clear glass", build: (d, o) => ({ ...(d ? DI : LI), layers: <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: "linear-gradient(135deg,rgba(255,255,255,0.22),transparent 40%)" }} />, container: { background: `rgba(255,255,255,${o.opacity ?? (d ? 0.1 : 0.22)})`, backdropFilter: `blur(${o.blur ?? 10}px) saturate(130%)`, WebkitBackdropFilter: `blur(${o.blur ?? 10}px) saturate(130%)`, border: `1px solid ${d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"}`, boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 14px 32px rgba(0,0,0,0.26)" } }) },
  { key: "gfEdge", name: "V4 · Edge-lit thin glass", build: (d, o) => ({ ...(d ? DI : LI), layers: <>
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", padding: 1.5, pointerEvents: "none", background: "linear-gradient(135deg,rgba(255,255,255,0.8),rgba(255,255,255,0.1) 40%,transparent 60%,rgba(255,255,255,0.5))", WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" } as CSSProperties} />
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: "radial-gradient(120% 80% at 30% 6%, rgba(255,255,255,0.28), transparent 44%)" }} />
    </>, container: { background: `rgba(255,255,255,${o.opacity ?? (d ? 0.04 : 0.14)})`, backdropFilter: `blur(${o.blur ?? 5}px) saturate(125%)`, WebkitBackdropFilter: `blur(${o.blur ?? 5}px) saturate(125%)`, border: "1.5px solid transparent", boxShadow: "0 0 0 1px rgba(255,255,255,0.14) inset, 0 1.5px 1px rgba(255,255,255,0.7) inset, 0 -2px 2px rgba(255,255,255,0.18) inset, 0 16px 34px rgba(0,0,0,0.3)" } }) },
];

type Layout = "standard" | "compact" | "prominent" | "minimal";
type Accent = "leftBar" | "topBar" | "iconOnly" | "tint" | "glow";
type Timer = "bottomBar" | "topBar" | "ring" | "accentDeplete" | "none";
type Motion = "slideRight" | "rise" | "scaleFade" | "blurIn" | "spring";

const LAYOUTS: { k: Layout; n: string }[] = [{ k: "standard", n: "Standard" }, { k: "compact", n: "Compact" }, { k: "prominent", n: "Prominent" }, { k: "minimal", n: "Minimal" }];
const ACCENTS: { k: Accent; n: string }[] = [{ k: "leftBar", n: "Left bar" }, { k: "topBar", n: "Top bar" }, { k: "iconOnly", n: "Icon only" }, { k: "tint", n: "Tint wash" }, { k: "glow", n: "Glow" }];
const TIMERS: { k: Timer; n: string }[] = [{ k: "bottomBar", n: "Bottom bar" }, { k: "topBar", n: "Top bar" }, { k: "ring", n: "Ring" }, { k: "accentDeplete", n: "Deplete" }, { k: "none", n: "None" }];
const MOTIONS: { k: Motion; n: string }[] = [{ k: "slideRight", n: "Slide" }, { k: "rise", n: "Rise" }, { k: "scaleFade", n: "Scale" }, { k: "blurIn", n: "Blur in" }, { k: "spring", n: "Spring" }];

const RING_R = 9, RING_C = 2 * Math.PI * RING_R;

function Toast({ type, mat, dark, o, layout, accent, timer, motion, radius, width, replay }: {
  type: ToastType; mat: Material; dark: boolean; o: Overrides; layout: Layout; accent: Accent; timer: Timer; motion: Motion; radius: number; width: number; replay: number;
}) {
  const b = mat.build(dark, o);
  const Icon = ICONS[type];
  const ac = ACCENT[type];
  const dense = layout === "compact";
  const showDesc = layout !== "compact";
  const padding = layout === "compact" ? "9px 12px" : layout === "prominent" ? "15px 16px" : "12px 14px";
  const iconSize = layout === "prominent" ? 32 : 28;

  const container: CSSProperties = { ...b.container, borderRadius: radius };
  if (accent === "leftBar") container.borderLeft = `3px solid ${ac}`;
  if (accent === "topBar") container.borderTop = `3px solid ${ac}`;
  if (accent === "glow") container.boxShadow = `${container.boxShadow ?? ""}, 0 0 22px color-mix(in srgb, ${ac} 30%, transparent)`;

  const content = (
    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: layout === "prominent" ? "flex-start" : "center", gap: 12, padding }}>
      {layout === "minimal" ? (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ac, flexShrink: 0, marginTop: layout === "minimal" ? 5 : 0 }} />
      ) : (
        <div style={{ position: "relative", width: iconSize, height: iconSize, borderRadius: "50%", background: ICONBG[type], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon weight="fill" style={{ width: iconSize * 0.57, height: iconSize * 0.57, color: ac }} />
          {timer === "ring" && (
            <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: -3, width: iconSize + 6, height: iconSize + 6, transform: "rotate(-90deg)" }}>
              <circle cx="12" cy="12" r={RING_R} fill="none" stroke={ac} strokeOpacity={0.25} strokeWidth="2" />
              <circle cx="12" cy="12" r={RING_R} fill="none" stroke={ac} strokeWidth="2" strokeLinecap="round" strokeDasharray={RING_C} style={{ animation: "tl-ring 4s linear infinite" }} />
            </svg>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: layout === "prominent" ? 14.5 : 13.5, fontWeight: 600, color: b.ink, lineHeight: 1.35 }}>{COPY[type].t}</p>
        {showDesc && <p style={{ margin: "2px 0 0", fontSize: 12, color: b.subInk, lineHeight: 1.4 }}>{COPY[type].d}</p>}
        {layout === "prominent" && type === "success" && (
          <button style={{ marginTop: 10, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#fff", background: ac, border: "none", borderRadius: 8, cursor: "pointer" }}>Undo</button>
        )}
      </div>
      {layout !== "prominent" && type === "success" && (
        <button style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, color: ac, background: "transparent", border: "none", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}>Undo</button>
      )}
      <button aria-label="Dismiss" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: b.subInk, cursor: "pointer", borderRadius: 7, flexShrink: 0, padding: 0 }}><X style={{ width: 13, height: 13 }} /></button>
    </div>
  );

  const inner = (
    <div style={{ position: "relative", width, maxWidth: width, overflow: "hidden", ["--toast-accent" as string]: ac, ...container } as CSSProperties}>
      {accent === "tint" && <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: `color-mix(in srgb, ${ac} 14%, transparent)` }} />}
      {b.layers}
      {timer === "accentDeplete" && <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: ac, transformOrigin: "top", animation: "tl-deplete 4s linear infinite" }} />}
      {content}
      {(timer === "bottomBar" || timer === "topBar") && (
        <span aria-hidden style={{ position: "absolute", left: 0, [timer === "bottomBar" ? "bottom" : "top"]: 0, height: 2, width: "100%", background: ac, opacity: 0.85, transformOrigin: "left", animation: "tl-bar 4s linear infinite" } as CSSProperties} />
      )}
    </div>
  );

  const motioned = <div key={`${motion}-${replay}`} style={{ animation: `tl-${motion} 420ms cubic-bezier(0.2,0.8,0.2,1) both` }}>{inner}</div>;
  return b.wrapper ? <div style={b.wrapper}>{motioned}</div> : motioned;
}

const SEG = (active: boolean): CSSProperties => ({ padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", background: active ? "var(--agent-coral)" : "transparent", color: active ? "#fff" : "var(--agent-text-secondary)" });
function Seg<T extends string>({ opts, value, onChange }: { opts: { k: T; n: string }[]; value: T; onChange: (v: T) => void }) {
  return <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 2, padding: 3, borderRadius: 10, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)" }}>{opts.map((o) => <button key={o.k} onClick={() => onChange(o.k)} style={SEG(o.k === value)}>{o.n}</button>)}</div>;
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 7 }}><p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--agent-text-muted)" }}>{label}</p>{children}</div>;
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [matKey, setMatKey] = useState("apple2026");
  const [layout, setLayout] = useState<Layout>("standard");
  const [accent, setAccent] = useState<Accent>("leftBar");
  const [timer, setTimer] = useState<Timer>("bottomBar");
  const [motion, setMotion] = useState<Motion>("slideRight");
  const [radius, setRadius] = useState(16);
  const [width, setWidth] = useState(360);
  const [blur, setBlur] = useState<number | "">("");
  const [opacity, setOpacity] = useState<number | "">("");
  const [stack, setStack] = useState<"separate" | "pile">("separate");
  const [replay, setReplay] = useState(0);

  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);
  const mat = MATERIALS.find((m) => m.key === matKey)!;
  const o: Overrides = { blur: blur === "" ? undefined : blur, opacity: opacity === "" ? undefined : opacity };
  const common = { mat, dark, o, layout, accent, timer, motion, radius, width, replay };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "300px 1fr" }}>
      <style>{`
        @keyframes tl-bar { from { transform: scaleX(1) } to { transform: scaleX(0) } }
        @keyframes tl-deplete { from { transform: scaleY(1) } to { transform: scaleY(0) } }
        @keyframes tl-ring { from { stroke-dashoffset: 0 } to { stroke-dashoffset: ${RING_C} } }
        @keyframes tl-slideRight { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: none } }
        @keyframes tl-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        @keyframes tl-scaleFade { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: none } }
        @keyframes tl-blurIn { from { opacity: 0; filter: blur(9px); transform: translateY(8px) } to { opacity: 1; filter: blur(0); transform: none } }
        @keyframes tl-spring { 0% { opacity: 0; transform: translateX(30px) } 60% { opacity: 1; transform: translateX(-5px) } 100% { transform: none } }
      `}</style>

      {/* Controls */}
      <aside style={{ borderRight: "0.5px solid var(--agent-border-default)", padding: "18px 16px", height: "100vh", position: "sticky", top: 0, overflowY: "auto", background: "var(--agent-surface-elevated)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>Toast lab</h1>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setReplay((v) => v + 1)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 8, border: "none", background: "var(--agent-coral)", color: "#fff", cursor: "pointer" }}>Replay ▸</button>
            <button onClick={() => setDark((v) => !v)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", color: "var(--agent-text-secondary)", cursor: "pointer" }}>{dark ? "Dark" : "Light"}</button>
          </div>
        </div>

        <Group label="Material">
          <select value={matKey} onChange={(e) => setMatKey(e.target.value)} style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-base, #fff)", color: "var(--agent-text-primary)", fontSize: 13 }}>
            {MATERIALS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
        </Group>
        <Group label="Layout"><Seg opts={LAYOUTS} value={layout} onChange={setLayout} /></Group>
        <Group label="Accent"><Seg opts={ACCENTS} value={accent} onChange={setAccent} /></Group>
        <Group label="Timer indicator"><Seg opts={TIMERS} value={timer} onChange={setTimer} /></Group>
        <Group label="Enter motion"><Seg opts={MOTIONS} value={motion} onChange={setMotion} /></Group>
        <Group label="Stacking"><Seg opts={[{ k: "separate" as const, n: "Separate" }, { k: "pile" as const, n: "Collapsed pile" }]} value={stack} onChange={setStack} /></Group>

        <Group label="Shape">
          <label style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Radius {radius}px<input type="range" min={8} max={24} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--agent-coral)" }} /></label>
          <label style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Width {width}px<input type="range" min={300} max={440} value={width} onChange={(e) => setWidth(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--agent-coral)" }} /></label>
        </Group>
        <Group label="Glass fine-tune">
          <label style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Blur {blur === "" ? "(default)" : `${blur}px`}<input type="range" min={0} max={60} value={blur === "" ? 24 : blur} onChange={(e) => setBlur(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--agent-coral)" }} /></label>
          <label style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Opacity {opacity === "" ? "(default)" : opacity.toFixed(2)}<input type="range" min={0.1} max={1} step={0.02} value={opacity === "" ? 0.5 : opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--agent-coral)" }} /></label>
          <button onClick={() => { setBlur(""); setOpacity(""); }} style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset</button>
        </Group>
      </aside>

      {/* Preview */}
      <main style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0 }}>
          {[{ c: "#FF8A65", x: "16%", y: "22%", s: 440 }, { c: "#3D7A8F", x: "70%", y: "18%", s: 400 }, { c: "#8B6AC8", x: "40%", y: "72%", s: 520 }, { c: "#E0B23A", x: "82%", y: "66%", s: 360 }].map((bl, i) => (
            <div key={i} style={{ position: "absolute", left: bl.x, top: bl.y, width: bl.s, height: bl.s, borderRadius: "50%", background: bl.c, filter: "blur(70px)", opacity: dark ? 0.5 : 0.42, transform: "translate(-50%,-50%)" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: dark ? 0.12 : 0.1 }}><span style={{ fontSize: 220, fontWeight: 800, color: dark ? "#fff" : "#2D1810", letterSpacing: "-0.04em" }}>glass</span></div>
        </div>

        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          {stack === "separate" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(["success", "info", "error"] as ToastType[]).map((t) => <Toast key={t} type={t} {...common} />)}
            </div>
          ) : (
            // Collapsed pile — overlapped, scaled back; hover to spread (Sonner-style).
            <div className="tl-pile" style={{ position: "relative", width, height: 120 }}>
              <style>{`.tl-pile > div { transition: transform .32s cubic-bezier(.2,.8,.2,1); position: absolute; left: 0; right: 0; }
                .tl-pile > div:nth-child(1){ transform: translateY(0) scale(1); z-index:3 }
                .tl-pile > div:nth-child(2){ transform: translateY(12px) scale(0.955); z-index:2 }
                .tl-pile > div:nth-child(3){ transform: translateY(22px) scale(0.91); z-index:1 }
                .tl-pile:hover > div:nth-child(1){ transform: translateY(0) scale(1) }
                .tl-pile:hover > div:nth-child(2){ transform: translateY(80px) scale(1) }
                .tl-pile:hover > div:nth-child(3){ transform: translateY(160px) scale(1) }`}</style>
              {(["success", "info", "error"] as ToastType[]).map((t) => <div key={t}><Toast type={t} {...common} /></div>)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
