"use client";

// Nav glass material for the portal preview. The PRIMARY target is the frosted
// fallback (phones / Safari / Firefox can't present url()-backdrop refraction),
// so the frost is tuned to look premium on its own: warm portal tint, layered
// shadow, inset specular highlight and a faint grain so it reads as physical
// glass, not a flat panel. On Chromium (desktop) we layer the real refraction
// engine on top as a bonus — toggleable, since the live portal is mobile-first.

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";
import { createSpring, retuneSpring, stepSpring, createFrameLoop, motionReduced, type Spring } from "@/components/liquid/lib/spring";

export type ActiveStyle = "underline" | "dot" | "solid" | "outline" | "glass" | "lift" | "topbar" | "plain";

export type PreviewSettings = {
  theme: "light" | "dark";
  frosted: boolean;
  accent: string;
  active: ActiveStyle; // how the current tab is signalled
  blur: number; // frost blur (fallback: px; refraction: centre-blur control)
  opacity: number; // surface tint alpha 0..1
  saturate: number; // backdrop saturation %
  shadow: number; // shadow depth 0..1
  edge: number; // border/edge-highlight strength 0..1
  grain: number; // grain opacity 0..1 (fallback only)
  displace: number; // refraction: how hard the rim bends the backdrop
  aberration: number; // refraction: chromatic split at the rim (0 = none)
};
export const DEFAULT_PREVIEW: PreviewSettings = { theme: "light", frosted: true, accent: "#FF6B4A", active: "underline", blur: 24, opacity: 0.72, saturate: 190, shadow: 0.5, edge: 0.66, grain: 0.42, displace: 48, aberration: 1 };
const Ctx = createContext<PreviewSettings>(DEFAULT_PREVIEW);
export const usePreview = () => useContext(Ctx);
export function PreviewProvider({ value, children }: { value: PreviewSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChromium(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua);
    const firefox = /firefox|fxios/i.test(ua);
    setOk(!(iOS || safari || firefox));
  }, []);
  return ok;
}

export function useSpringValue(target: number, response = 0.4, bounce = 0.3): number {
  const [val, setVal] = useState(target);
  const spring = useRef<Spring | null>(null);
  const loop = useRef<{ start(): void; stop(): void } | null>(null);
  if (spring.current === null) spring.current = createSpring(response, bounce, target);
  useEffect(() => {
    const sp = spring.current;
    if (!sp) return;
    sp.target = target;
    retuneSpring(sp, response, bounce);
    if (!loop.current) {
      loop.current = createFrameLoop((dt) => { const cont = stepSpring(sp, dt, motionReduced()); setVal(sp.value); return cont; });
    }
    loop.current.start();
  }, [target, response, bounce]);
  useEffect(() => () => loop.current?.stop(), []);
  return val;
}

// The nav surface. Frosted by default (the real phone experience); refraction on
// Chromium when not forced to frosted.
export function NavGlass({ radius = 24, className = "", style, children }: { radius?: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const s = usePreview();
  const chromium = useChromium();
  const real = !s.frosted && chromium;
  if (real) {
    // Improved lens: the RIM bends the backdrop (displace) while the CENTRE is a
    // real blurred refraction (a strong frost over the near-neutral interior),
    // not a crisp, tripled copy. Chromatic split is kept minimal by default so
    // the backdrop isn't separated into three — push "Chromatic" up for fringe.
    const tint = s.theme === "dark" ? `rgba(26,32,41,${(s.opacity * 0.78).toFixed(2)})` : `rgba(255,247,243,${(s.opacity * 0.78).toFixed(2)})`;
    return (
      <LiquidGlass radius={radius} blur={Math.max(2, s.blur / 3)} displace={s.displace} aberration={s.aberration} tint={tint} className={`ppv-glass ppv-glass--real ${className}`} style={style}>
        {children}
      </LiquidGlass>
    );
  }
  return (
    <div className={`ppv-glass ppv-frost ${className}`} style={{ borderRadius: radius, ...style }}>
      <span aria-hidden className="ppv-grain" />
      {children}
    </div>
  );
}
