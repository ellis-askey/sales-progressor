"use client";
// LiquidLens — EXPERIMENTAL slab-optics glass material, a variant ALONGSIDE the
// current <LiquidGlass>. Uses the slab refraction map (components/liquid/lib/
// refraction-map.ts, adapted from Glassy UI, MIT): a crisp neutral centre with a
// thin inward-pulling rim band, so the backdrop is cleanly magnified at the edge.
// Single displacement pass + a B-channel-masked rim blur — no streaks.
//
// Not yet the default. Compared against <LiquidGlass> at /dev/glass-optics.
// Shares the `.lgx-surface` base class in app/styles/liquid-glass.css.

import {
  useEffect, useId, useRef, useState,
  type CSSProperties, type HTMLAttributes, type ReactNode,
} from "react";
import { buildLensMap, computeLensMetrics, type LensMetrics, type RefractionStrength } from "./lib/refraction-map";

export type LiquidLensProps = HTMLAttributes<HTMLDivElement> & {
  radius?: number;
  strength?: RefractionStrength;
  thickness?: number;
  displacement?: number;
  blur?: number;
  tint?: string;
  /** Force the Safari/Firefox CSS fallback (for comparison/testing in Chromium). */
  forceFallback?: boolean;
  children?: ReactNode;
};

// Browsers that don't support url() inside backdrop-filter (Safari, Firefox) can't
// run the displacement lens. Detected once; those get a polished convex-dome
// fallback (highlight + rim + contact shadow over a frost) that keeps the shape.
function supportsBackdropUrl(): boolean {
  if (typeof CSS === "undefined" || !CSS.supports) return false;
  return CSS.supports("backdrop-filter", "url(#x)") || CSS.supports("-webkit-backdrop-filter", "url(#x)");
}

export function LiquidLens({
  radius = 18, strength = "strong", thickness = 1.3, displacement, blur = 0,
  tint = "rgba(255,255,255,0.1)", forceFallback = false, className = "", style, children, ...rest
}: LiquidLensProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const fid = `ll${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<{ href: string; m: LensMetrics } | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => { setSupported(supportsBackdropUrl()); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 1 && size.h > 1) {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const m = computeLensMetrics({ width: size.w, height: size.h, radius, strength, thickness, displacement, dpr });
      const href = buildLensMap(m);
      if (href) setState({ href, m });
    }
  }, [size, radius, strength, thickness, displacement]);

  const ready = !!state;
  const useFilter = ready && supported && !forceFallback;
  const bf = useFilter
    ? `url(#${fid}) saturate(175%) brightness(1.03)${blur ? ` blur(${blur}px)` : ""}`
    : "blur(9px) saturate(160%)"; // polished frost for the fallback
  const mergedStyle: CSSProperties = {
    borderRadius: radius,
    background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.03))`,
    backdropFilter: bf,
    ...style,
  };
  (mergedStyle as CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = bf;

  const m = state?.m;
  return (
    <div ref={ref} className={`lgx-surface ll-surface ${useFilter ? "" : "ll-fallback"} ${className}`} style={mergedStyle} {...rest}>
      {useFilter && m && (
        <svg className="lgx-filter-svg" width={size.w} height={size.h} aria-hidden focusable="false">
          <defs>
            <filter id={fid} filterUnits="userSpaceOnUse" x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} colorInterpolationFilters="sRGB">
              <feImage href={state.href} x={-m.filterPadding} y={-m.filterPadding} width={m.paddedWidth} height={m.paddedHeight} preserveAspectRatio="none" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={m.filterScale} xChannelSelector="R" yChannelSelector="G" result="disp" />
              {/* rim-only blur: blur the displaced scene, keep it only where the
                  map's B channel marks the rim, lay it over the crisp centre. */}
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

export default LiquidLens;
