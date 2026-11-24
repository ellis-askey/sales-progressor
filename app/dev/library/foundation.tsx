"use client";
// TSP library · Phase-0 foundations (isolated to /dev/library; nothing Approved).
//
// Three shared primitives that the controls are rebuilt on:
//   • Surface            — the deliberate material system (solid / frost / lens),
//                          environment-aware (reduced transparency → opaque).
//   • TravellingSelection — one continuous glass pill that SLIDES + RESIZES between
//                          options on spring.ts. Powers Segmented, Tabs, the Dock
//                          active state — one selection language across the library.
//   • SliderThumb        — a thumb that genuinely TRANSITIONS material: a solid
//                          capsule at rest whose refraction (feDisplacementMap scale)
//                          ramps up from 0 as the solid cap recedes while dragging,
//                          then returns on release. Not a crossfade of two looks.
//
// Reuses READ-ONLY: the slab refraction map + the Lens, and spring.ts via ./lib.

import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
import { buildLensMap, computeLensMetrics, type LensMetrics } from "@/components/liquid/lib/refraction-map";
import { cn, useEnv, useSpringTo, Lens } from "./lib";

/* ── Surface — material by function, not by default ──────────────────────────
   solid  = static controls + dense content (opaque, always legible)
   frost  = small portalled overlays / chrome over content (blur, no smear)
   lens   = floating + moving controls (genuine displacement refraction)
   Under reduced-transparency, frost/lens collapse to solid (accessibility). */
export type Material = "solid" | "frost" | "lens";
export function Surface({ material, radius = 14, lensThickness = 1.35, tint, className = "", style, children }:
  { material: Material; radius?: number; lensThickness?: number; tint?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const { reducedTransparency, contrast } = useEnv();
  const mat: Material = reducedTransparency && material !== "solid" ? "solid" : material;
  if (mat === "lens") {
    return <Lens radius={radius} thickness={lensThickness} tint={tint} className={cn("tlf-surf tlf-surf--lens", contrast && "tlf-surf--contrast", className)} style={style}>{children}</Lens>;
  }
  return <div className={cn("tlf-surf", `tlf-surf--${mat}`, contrast && "tlf-surf--contrast", className)} style={{ borderRadius: radius, ...style }}>{children}</div>;
}

/* ── TravellingSelection — the moving glass pill (one continuous object) ────── */
export type SelItem<T extends string> = { value: T; label?: ReactNode; icon?: ReactNode; "aria-label"?: string };
export function TravellingSelection<T extends string>({
  items, value, onChange, ariaLabel, variant = "segmented", size = "md", equal = false,
}: {
  items: SelItem<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string;
  variant?: "segmented" | "tabs"; size?: "sm" | "md"; equal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { reducedMotion, reducedTransparency, contrast } = useEnv();
  const idx = Math.max(0, items.findIndex((i) => i.value === value));
  const [box, setBox] = useState({ left: 0, width: 0, top: 0, height: 0 });

  const measure = useCallback(() => {
    const c = ref.current; const el = c?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (!c || !el) return;
    setBox((p) => (p.left === el.offsetLeft && p.width === el.offsetWidth && p.top === el.offsetTop && p.height === el.offsetHeight ? p : { left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight }));
  }, [idx]);
  useLayoutEffect(() => { measure(); }, [measure, items.length]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ro = new ResizeObserver(measure); ro.observe(c);
    c.querySelectorAll("[data-idx]").forEach((n) => ro.observe(n));
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 60); // re-measure once fonts settle
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);

  // left + width spring on the SAME config → the pill reads as one object that
  // travels and morphs its width together (resizing feels physical, not a swap).
  const left = useSpringTo(box.left, 0.42, 0.32, !reducedMotion);
  const width = useSpringTo(box.width, 0.42, 0.32, !reducedMotion);

  const move = (n: number) => { const c = Math.max(0, Math.min(items.length - 1, n)); onChange(items[c].value); ref.current?.querySelector<HTMLElement>(`[data-idx="${c}"]`)?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(idx + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(idx - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(items.length - 1); }
  };

  return (
    <div ref={ref} className={cn("tlf-sel", `tlf-sel--${variant}`, `tlf-sel--${size}`)} role="tablist" aria-label={ariaLabel}
      data-rt={reducedTransparency || undefined} data-contrast={contrast || undefined}
      style={equal ? ({ ["--cols" as string]: items.length } as CSSProperties) : undefined} onKeyDown={onKey}>
      <span className="tlf-sel-pill" aria-hidden style={{ transform: `translate(${left}px, ${box.top}px)`, width, height: box.height }}>
        <span className="tlf-sel-pill-face" />
      </span>
      {items.map((it, i) => (
        <button key={it.value} data-idx={i} role="tab" aria-selected={i === idx} aria-label={it["aria-label"]} tabIndex={i === idx ? 0 : -1}
          className={cn("tlf-sel-opt", equal && "tlf-sel-opt--equal")} data-on={i === idx || undefined} onClick={() => onChange(it.value)}>
          {it.icon && <span className="tlf-sel-ico">{it.icon}</span>}
          {it.label != null && <span className="tlf-sel-lbl">{it.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── SliderThumb — genuine solid → refractive → solid material transition ────
   The refraction magnitude (feDisplacementMap `scale`) is animated from 0 → full
   by the drag spring, while a solid cap recedes over it. The map is built ONCE
   (no per-frame canvas rebuild) so only a cheap SVG attribute animates. */
const THUMB_W = 46, THUMB_H = 30, THUMB_R = 15;
function supportsBackdropUrl(): boolean {
  if (typeof CSS === "undefined" || !CSS.supports) return false;
  return CSS.supports("backdrop-filter", "url(#x)") || CSS.supports("-webkit-backdrop-filter", "url(#x)");
}
export function SliderThumb({ active, speed }: { active: boolean; speed: number }) {
  const { reducedMotion } = useEnv();
  const rawId = useId(); const fid = `slt${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [map, setMap] = useState<{ href: string; m: LensMetrics } | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => { setSupported(supportsBackdropUrl()); }, []);
  useEffect(() => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const m = computeLensMetrics({ width: THUMB_W, height: THUMB_H, radius: THUMB_R, strength: "strong", thickness: 1.6, dpr });
    const href = buildLensMap(m); if (href) setMap({ href, m });
  }, []);

  // grip: 0 solid at rest → 1 full glass while dragging (continuous, spring-driven).
  const grip = useSpringTo(active ? 1 : 0, 0.3, 0.2, !reducedMotion);
  const sx = useSpringTo(active ? 1 + Math.min(0.26, speed * 0.3) : 1, 0.28, 0.4, !reducedMotion);
  const sy = useSpringTo(active ? 1 - Math.min(0.12, speed * 0.16) : 1, 0.28, 0.4, !reducedMotion);

  const m = map?.m;
  const useFilter = !!map && supported;
  const scale = m ? grip * m.filterScale : 0; // refraction ramps with grip
  const bf = useFilter ? `url(#${fid}) saturate(${(1 + grip * 0.7).toFixed(2)}) brightness(${(1 + grip * 0.05).toFixed(3)})` : `blur(${(grip * 7).toFixed(1)}px) saturate(150%)`;

  return (
    <span className="tlf-sthumb" style={{ width: THUMB_W, height: THUMB_H, transform: `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` }}>
      <span className="tlf-sthumb-glass" style={{ borderRadius: THUMB_R, backdropFilter: bf, WebkitBackdropFilter: bf, opacity: useFilter ? 1 : 0.35 + 0.65 * grip } as CSSProperties}>
        {useFilter && m && (
          <svg className="tlf-sthumb-svg" width={THUMB_W} height={THUMB_H} aria-hidden focusable="false">
            <defs>
              <filter id={fid} filterUnits="userSpaceOnUse" x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} colorInterpolationFilters="sRGB">
                <feImage href={map!.href} x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} preserveAspectRatio="none" result="map" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="disp" />
                <feGaussianBlur in="disp" stdDeviation={m.rimBlur} result="dispBlur" />
                <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="rimA" />
                <feComposite in="dispBlur" in2="rimA" operator="in" result="rim" />
                <feMerge><feMergeNode in="disp" /><feMergeNode in="rim" /></feMerge>
              </filter>
            </defs>
          </svg>
        )}
      </span>
      {/* solid cap — opaque at rest, recedes as the glass refraction grows */}
      <span className="tlf-sthumb-solid" style={{ borderRadius: THUMB_R, opacity: 1 - grip }} />
      <span className="tlf-sthumb-rim" style={{ borderRadius: THUMB_R }} />
    </span>
  );
}

export const FOUNDATION_CSS = `
/* ── materials ─────────────────────────────────────────────────────────────── */
.tlf-surf{ position:relative; }
.tlf-surf--solid{ background:var(--lg-fill); border:1px solid var(--lg-line); box-shadow:0 1px 2px rgba(0,0,0,.14); }
.lg-ds[data-theme="light"] .tlf-surf--solid{ background:#fff; box-shadow:0 1px 3px rgba(20,30,60,.12); }
.tlf-surf--frost{ background:color-mix(in srgb, var(--lg-base) 70%, transparent); -webkit-backdrop-filter:blur(18px) saturate(165%); backdrop-filter:blur(18px) saturate(165%); border:1px solid var(--lg-line); box-shadow:inset 0 1px 0 rgba(255,255,255,.16), 0 10px 30px rgba(0,0,0,.3); }
.lg-ds[data-theme="light"] .tlf-surf--frost{ background:color-mix(in srgb,#fff 64%, transparent); box-shadow:inset 0 1px 0 rgba(255,255,255,.8), 0 10px 26px rgba(20,30,60,.16); }
.tlf-surf--contrast{ border-color:var(--lg-ink-3) !important; }

/* ── travelling selection (segmented + tabs share this) ─────────────────────── */
.tlf-sel{ position:relative; display:inline-flex; align-items:center; isolation:isolate; }
.tlf-sel--segmented{ padding:3px; border-radius:11px; background:rgba(0,0,0,.24); border:1px solid var(--lg-line); box-shadow:inset 0 1px 2px rgba(0,0,0,.28); }
.lg-ds[data-theme="light"] .tlf-sel--segmented{ background:rgba(12,16,28,.06); box-shadow:inset 0 1px 2px rgba(20,30,60,.08); }
.tlf-sel--tabs{ padding:4px; border-radius:12px; background:rgba(0,0,0,.14); border:1px solid var(--lg-line-2); }
.lg-ds[data-theme="light"] .tlf-sel--tabs{ background:rgba(12,16,28,.04); }
.tlf-sel-pill{ position:absolute; top:0; left:0; z-index:0; border-radius:8px; pointer-events:none; }
.tlf-sel--tabs .tlf-sel-pill{ border-radius:9px; }
.tlf-sel-pill-face{ position:absolute; inset:0; border-radius:inherit; background:linear-gradient(180deg, rgba(255,255,255,.17), rgba(255,255,255,.05)); -webkit-backdrop-filter:blur(7px) saturate(150%); backdrop-filter:blur(7px) saturate(150%); border:.5px solid rgba(255,255,255,.26); box-shadow:inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 2px rgba(0,0,0,.18), 0 2px 7px rgba(0,0,0,.3); }
.lg-ds[data-theme="light"] .tlf-sel-pill-face{ background:#fff; border:.5px solid rgba(20,30,60,.06); box-shadow:0 1px 3px rgba(20,30,60,.22), inset 0 1px 0 rgba(255,255,255,.9); }
.tlf-sel[data-rt] .tlf-sel-pill-face{ -webkit-backdrop-filter:none; backdrop-filter:none; background:var(--lg-fill); }
.lg-ds[data-theme="light"] .tlf-sel[data-rt] .tlf-sel-pill-face{ background:#fff; }
.tlf-sel[data-contrast] .tlf-sel-pill-face{ border-color:var(--lg-ink-2); }
.tlf-sel-opt{ position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:none; border:none; cursor:pointer; font:inherit; font-weight:600; color:var(--lg-ink-3); white-space:nowrap; transition:color .28s cubic-bezier(.3,.9,.3,1); }
.tlf-sel-opt--equal{ flex:1; }
.tlf-sel--segmented .tlf-sel-opt{ height:30px; padding:0 15px; font-size:12.5px; letter-spacing:-.006em; border-radius:8px; }
.tlf-sel--sm.tlf-sel--segmented .tlf-sel-opt{ height:26px; padding:0 12px; font-size:12px; }
.tlf-sel--tabs .tlf-sel-opt{ height:34px; padding:0 17px; font-size:13px; border-radius:9px; }
.tlf-sel-opt:hover:not([data-on]){ color:var(--lg-ink-2); }
.tlf-sel-opt[data-on]{ color:var(--lg-ink); }
.tlf-sel-opt:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tlf-sel-ico{ display:inline-flex; } .tlf-sel-ico svg{ width:16px; height:16px; }

/* ── slider thumb (genuine material transition) ──────────────────────────────── */
.tlf-slider-thumb{ display:block; outline:none; cursor:grab; } .tlf-slider-thumb:active{ cursor:grabbing; }
.tlf-sthumb{ position:relative; display:block; will-change:transform; }
.tlf-sthumb-glass{ position:absolute; inset:0; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03)); }
.tlf-sthumb-svg{ position:absolute; width:0; height:0; overflow:hidden; }
.tlf-sthumb-solid{ position:absolute; inset:0; background:linear-gradient(180deg,#ffffff,#e9ebf2); box-shadow:0 3px 9px rgba(0,0,0,.3); }
.lg-ds[data-theme="light"] .tlf-sthumb-solid{ background:linear-gradient(180deg,#ffffff,#eef0f6); box-shadow:0 2px 7px rgba(20,30,60,.22); }
.tlf-sthumb-rim{ position:absolute; inset:0; pointer-events:none; border:.5px solid rgba(255,255,255,.42); box-shadow:inset 0 1px 1px rgba(255,255,255,.6), inset 0 -1px 2px rgba(0,0,0,.14); }
.tlf-slider-thumb:focus-visible .tlf-sthumb-rim{ box-shadow:0 0 0 3px var(--lg-accent-soft), 0 0 0 1.5px var(--lg-accent); }
`;
