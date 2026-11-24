"use client";
// Local experimental material treatments + functional controls for the optics lab.
// Uses the shared LiquidLens / refraction-map / spring READ-ONLY. Nothing here is a
// shared component or Approved — it exists only to compare optical treatments.

import {
  useEffect, useId, useRef, useState, type CSSProperties, type ReactNode,
} from "react";
import { LiquidLens } from "@/components/liquid/LiquidLens";
import { buildLensMap, computeLensMetrics, type LensMetrics } from "@/components/liquid/lib/refraction-map";
import { createSpring, stepSpring, createFrameLoop } from "@/components/liquid/lib/spring";

export type Variant = "baseline" | "refined" | "frost" | "clear" | "edge";
export const VARIANTS: { key: Variant; name: string; blurb: string; kind: "displace" | "css" }[] = [
  { key: "baseline", name: "V0 · Current slab lens", blurb: "what ships today — the control", kind: "displace" },
  { key: "refined", name: "V1 · Refined displacement", blurb: "tuned lens + edge / sheen / contact-shadow craft", kind: "displace" },
  { key: "frost", name: "V2 · Frosted vibrancy", blurb: "strong blur + saturation, no refraction", kind: "css" },
  { key: "clear", name: "V3 · Clear glass", blurb: "high translucency, minimal blur", kind: "css" },
  { key: "edge", name: "V4 · Edge-lit thin glass", blurb: "near-clear centre, bright refractive rim", kind: "css" },
];

export type MatProps = {
  variant: Variant; radius?: number; opaque?: boolean; contrast?: boolean; reduced?: boolean;
  className?: string; style?: CSSProperties; children?: ReactNode;
};

/* ── V1 local tuned displacement glass (mirrors LiquidLens wiring, retuned, with
      extra edge / sheen / contact-shadow craft via the .gf-disp class) ────────── */
// displacement: refraction-map's "strong" preset default is 112; the applied bend
// scales with (rimPull × displacement)/112. The earlier value of 16 under-displaced
// to ~1/7th and read as a flat panel. 120 gives a real, slightly-stronger bend.
function DisplaceSurface({ radius = 20, displacement = 120, blur = 0, tint = "rgba(255,255,255,0.05)", saturate = 1.85, className = "", style, children }:
  { radius?: number; displacement?: number; blur?: number; tint?: string; saturate?: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const fid = `gf${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<{ href: string; m: LensMetrics } | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(typeof CSS !== "undefined" && !!CSS.supports && (CSS.supports("backdrop-filter", "url(#x)") || CSS.supports("-webkit-backdrop-filter", "url(#x)")));
  }, []);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (size.w > 1 && size.h > 1) {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const m = computeLensMetrics({ width: size.w, height: size.h, radius, strength: "strong", thickness: 1.6, displacement, dpr });
      const href = buildLensMap(m);
      if (href) setState({ href, m });
    }
  }, [size, radius, displacement]);
  const ready = !!state;
  const useFilter = ready && supported;
  const bf = useFilter
    ? `url(#${fid}) saturate(${Math.round(saturate * 100)}%) brightness(1.04)${blur ? ` blur(${blur}px)` : ""}`
    : "blur(11px) saturate(175%)";
  const mStyle: CSSProperties = { borderRadius: radius, background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.02))`, backdropFilter: bf, ...style };
  (mStyle as CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = bf;
  const m = state?.m;
  return (
    <div ref={ref} className={`gf-disp ${useFilter ? "" : "gf-disp-fb"} ${className}`} style={mStyle}>
      {useFilter && m && (
        <svg className="gf-filter" width={size.w} height={size.h} aria-hidden focusable="false">
          <defs>
            <filter id={fid} filterUnits="userSpaceOnUse" x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} colorInterpolationFilters="sRGB">
              <feImage href={state.href} x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} preserveAspectRatio="none" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={m.filterScale} xChannelSelector="R" yChannelSelector="G" result="disp" />
              <feGaussianBlur in="disp" stdDeviation={m.rimBlur} result="dispBlur" />
              <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="rimA" />
              <feComposite in="dispBlur" in2="rimA" operator="in" result="rim" />
              <feMerge><feMergeNode in="disp" /><feMergeNode in="rim" /></feMerge>
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </div>
  );
}

/* ── the single surface primitive the lab compares ───────────────────────────── */
export function Foundry({ variant, radius = 20, opaque, contrast, className = "", style, children }: MatProps) {
  if (opaque) return <div className={`gf-opaque ${contrast ? "gf-contrast" : ""} ${className}`} style={{ borderRadius: radius, ...style }}>{children}</div>;
  if (variant === "baseline") return <LiquidLens radius={radius} strength="strong" thickness={1.3} className={className} style={style}>{children}</LiquidLens>;
  if (variant === "refined") return <DisplaceSurface radius={radius} className={`${contrast ? "gf-contrast" : ""} ${className}`} style={style}>{children}</DisplaceSurface>;
  const cls = variant === "frost" ? "gf-frost" : variant === "clear" ? "gf-clear" : "gf-edge";
  return <div className={`gf-css ${cls} ${contrast ? "gf-contrast" : ""} ${className}`} style={{ borderRadius: radius, ...style }}>{children}</div>;
}

/* ── spring value driver (reduced-motion aware) ──────────────────────────────── */
function useSpringTo(target: number, response = 0.4, bounce = 0.3, enabled = true) {
  const [v, setV] = useState(target);
  const sp = useRef<ReturnType<typeof createSpring> | null>(null);
  const loop = useRef<ReturnType<typeof createFrameLoop> | null>(null);
  useEffect(() => {
    if (!enabled) { setV(target); return; }
    if (!sp.current) sp.current = createSpring(response, bounce, target);
    sp.current.target = target;
    if (!loop.current) loop.current = createFrameLoop((dt) => { const moving = stepSpring(sp.current!, dt, false); setV(sp.current!.value); return moving; });
    loop.current.start();
  }, [target, enabled, response, bounce]);
  return v;
}

type CommonMat = Omit<MatProps, "children" | "radius" | "className" | "style">;

/* ── functional controls, each surfaced in the chosen material ───────────────── */
export function GButton({ mat, reducedMotion }: { mat: CommonMat; reducedMotion: boolean }) {
  const [done, setDone] = useState(false);
  const [press, setPress] = useState(false);
  const scale = useSpringTo(press ? 0.95 : 1, 0.28, 0.4, !reducedMotion);
  return (
    <button className="gf-ctl gf-btn" style={{ transform: `scale(${scale})` }}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      onClick={() => setDone((d) => !d)} aria-pressed={done}>
      <Foundry {...mat} radius={13} className="gf-ctl-surf" />
      <span className="gf-ctl-lab">{done ? "Date set ✓" : "Set a new date"}</span>
    </button>
  );
}

export function GSegmented({ mat, reducedMotion }: { mat: CommonMat; reducedMotion: boolean }) {
  const opts = ["Day", "Week", "Month"];
  const [i, setI] = useState(1);
  const x = useSpringTo(i, 0.36, 0.32, !reducedMotion);
  return (
    <div className="gf-ctl gf-seg" role="tablist" aria-label="Range">
      <div className="gf-seg-thumb" style={{ width: `calc((100% - 6px) / ${opts.length})`, transform: `translateX(calc(${x} * 100%))` }}>
        <Foundry {...mat} radius={9} className="gf-ctl-surf" />
      </div>
      {opts.map((o, n) => (
        <button key={o} role="tab" aria-selected={i === n} className="gf-seg-btn" data-on={i === n} onClick={() => setI(n)}>{o}</button>
      ))}
    </div>
  );
}

export function GSwitch({ mat, reducedMotion }: { mat: CommonMat; reducedMotion: boolean }) {
  const [on, setOn] = useState(true);
  const x = useSpringTo(on ? 1 : 0, 0.3, 0.42, !reducedMotion);
  return (
    <button role="switch" aria-checked={on} className="gf-ctl gf-switch" data-on={on} onClick={() => setOn((o) => !o)}>
      <span className="gf-switch-knob" style={{ transform: `translateX(${x * 20}px)` }}>
        <Foundry {...mat} radius={999} className="gf-ctl-surf" />
      </span>
    </button>
  );
}

export function GToolbar({ mat }: { mat: CommonMat }) {
  const [active, setActive] = useState(0);
  const icons = ["◻", "◷", "✎", "⌃", "⚙"];
  return (
    <div className="gf-ctl gf-toolbar">
      <Foundry {...mat} radius={18} className="gf-ctl-surf" />
      <div className="gf-toolbar-row">
        {icons.map((ic, n) => (
          <button key={n} className="gf-tool-btn" data-on={active === n} aria-label={`Tool ${n + 1}`} onClick={() => setActive(n)}>{ic}</button>
        ))}
      </div>
    </div>
  );
}

/* ── WCAG contrast — only ever applied to the OPAQUE fallback, where the surface
      colour is a real, fixed value. Never claimed for translucent glass. ──────── */
function toRgb(hex: string) { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function lum([r, g, b]: number[]) { const a = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
export function contrastRatio(a: string, b: string) { const la = lum(toRgb(a)) + 0.05, lb = lum(toRgb(b)) + 0.05; return Math.round((Math.max(la, lb) / Math.min(la, lb)) * 100) / 100; }
// the opaque fallback colours (fixed, measurable) per theme + high-contrast
export const OPAQUE = {
  dark: { surface: "#1c2130", ink: "#f3f4f8", contrastSurface: "#0c0f17", contrastInk: "#ffffff" },
  light: { surface: "#ffffff", ink: "#11141b", contrastSurface: "#ffffff", contrastInk: "#000000" },
};
