"use client";
// TSP component library — shared foundation (isolated to /dev/library).
// Reuses proven pieces READ-ONLY: LiquidLens (the chosen slab lens), spring.ts
// (motion), AppBackground (the Updates atmosphere), and the --lg coral tokens.
// Nothing shared, global, or production is modified. Nothing here is Approved.

import {
  createContext, forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { LiquidLens, type LiquidLensProps } from "@/components/liquid/LiquidLens";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

export type Theme = "dark" | "light";
export const ThemeCtx = createContext<Theme>("dark");
export function cn(...a: (string | false | undefined | null)[]) { return a.filter(Boolean).join(" "); }

/* ── environment (the Material Bench drives these; outside it, real system prefs) */
export type Env = { reducedMotion: boolean; reducedTransparency: boolean; contrast: boolean };
export const EnvCtx = createContext<Env>({ reducedMotion: false, reducedTransparency: false, contrast: false });
export function useEnv(): Env {
  const forced = useContext(EnvCtx);
  const [sysRM, setSysRM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSysRM(mq.matches);
    const on = () => setSysRM(mq.matches); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return { reducedMotion: forced.reducedMotion || sysRM, reducedTransparency: forced.reducedTransparency, contrast: forced.contrast };
}

/* ── motion (our spring.ts; reduced-motion aware) ─────────────────────────── */
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const on = () => setR(mq.matches); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}
export function useEnter(response = 0.5, bounce = 0.26) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (motionReduced()) { setV(1); return; }
    const s = createSpring(response, bounce, 0); s.target = 1;
    const loop = createFrameLoop((dt) => { const m = stepSpring(s, dt, false); setV(s.value); return m; });
    loop.start(); return () => loop.stop();
  }, [response, bounce]);
  return v;
}
export function useSpringTo(target: number, response = 0.4, bounce = 0.3, enabled = true) {
  const [v, setV] = useState(target);
  const sp = useRef<ReturnType<typeof createSpring> | null>(null);
  const loop = useRef<ReturnType<typeof createFrameLoop> | null>(null);
  useEffect(() => {
    if (!enabled) { setV(target); return; }
    if (!sp.current) sp.current = createSpring(response, bounce, target);
    sp.current.target = target;
    if (!loop.current) loop.current = createFrameLoop((dt) => { const m = stepSpring(sp.current!, dt, false); setV(sp.current!.value); return m; });
    loop.current.start();
  }, [target, enabled, response, bounce]);
  return v;
}

/* ── portal that re-establishes the .lg-ds scope + theme (tokens survive) ──── */
export function Portal({ children }: { children: ReactNode }) {
  const theme = useContext(ThemeCtx);
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m ? createPortal(<div className="lg-ds tl-portal" data-theme={theme}>{children}</div>, document.body) : null;
}
export function useAnchored(open: boolean, anchorRef: RefObject<HTMLElement>, floatRef: RefObject<HTMLElement>, opts: { side?: "top" | "bottom"; align?: "start" | "center" | "end"; gap?: number } = {}) {
  const { side = "bottom", align = "start", gap = 8 } = opts;
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const f = floatRef.current?.getBoundingClientRect();
      if (!a || !f) return;
      let top = side === "top" ? a.top - f.height - gap : a.bottom + gap;
      if (side === "bottom" && top + f.height > window.innerHeight - 10) top = a.top - f.height - gap;
      if (top < 10) top = 10;
      let left = align === "end" ? a.right - f.width : align === "center" ? a.left + a.width / 2 - f.width / 2 : a.left;
      left = Math.max(10, Math.min(left, window.innerWidth - f.width - 10));
      setPos({ top, left });
    };
    place(); const t = setTimeout(place, 0);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, side, align, gap, anchorRef, floatRef]);
  return pos;
}

/* ── the two-layer material system (the chosen optics, applied by function) ──
   Lens  = the slab lens (LiquidLens) for IN-FLOW content, hero + larger chrome.
   Frost = a non-displacement frosted surface for small, PORTALLED overlays, where
           a displacement lens smears the content behind it. (Established doctrine.) */
export function Lens(props: LiquidLensProps) { return <LiquidLens strength="strong" thickness={1.3} {...props} />; }
export const Frost = forwardRef<HTMLDivElement, { radius?: number; className?: string; style?: CSSProperties; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>>(
  function Frost({ radius = 14, className = "", style, children, ...rest }, ref) {
    return <div ref={ref} className={cn("tl-frost", className)} style={{ borderRadius: radius, ...style }} {...rest}>{children}</div>;
  }
);

/* ── the Updates atmosphere — matching how /dev/updates-glass actually renders:
   a dark base (var(--lg-base)) with a soft coral/cool aurora. (The raw AppBackground
   component is a full-brightness marketing wash; the Updates *look* is dark + subtle,
   so we replicate that look here rather than wash out dense content.) */
export function Atmosphere() {
  return (<><div className="tl-scene" aria-hidden /><div className="tl-scene tl-scene-2" aria-hidden /></>);
}
