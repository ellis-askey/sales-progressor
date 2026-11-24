"use client";
// Forward Liquid-Glass UI — foundation primitives. Canonical home (productionised
// from the /dev/library prototype). Depends only on the APPROVED engines
// (LiquidLens, spring) and the --lg tokens; never imports from /dev.

import {
  createContext, forwardRef, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { LiquidLens, type LiquidLensProps } from "@/components/liquid/LiquidLens";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

export type Theme = "dark" | "light";
export const ThemeCtx = createContext<Theme>("dark");
export function cn(...a: (string | false | undefined | null)[]) { return a.filter(Boolean).join(" "); }

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
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); setR(mq.matches); const on = () => setR(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
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

/* Portal that re-establishes the .lg-ds glass scope + theme so tokens resolve. */
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

export function Lens(props: LiquidLensProps) { return <LiquidLens strength="strong" thickness={1.3} {...props} />; }
export const Frost = forwardRef<HTMLDivElement, { radius?: number; className?: string; style?: CSSProperties; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>>(
  function Frost({ radius = 14, className = "", style, children, ...rest }, ref) {
    return <div ref={ref} className={cn("tl-frost", className)} style={{ borderRadius: radius, ...style }} {...rest}>{children}</div>;
  }
);
export function Atmosphere() { return (<><div className="tl-scene" aria-hidden /><div className="tl-scene tl-scene-2" aria-hidden /></>); }

/* ── material: solid / frost / lens (reduced-transparency aware) ─────────────── */
export type Material = "solid" | "frost" | "lens";
export function Surface({ material, radius = 14, lensThickness = 1.35, tint, className = "", style, children }:
  { material: Material; radius?: number; lensThickness?: number; tint?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const { reducedTransparency, contrast } = useEnv();
  const mat: Material = reducedTransparency && material !== "solid" ? "solid" : material;
  if (mat === "lens") return <Lens radius={radius} thickness={lensThickness} tint={tint} className={cn("tlf-surf tlf-surf--lens", contrast && "tlf-surf--contrast", className)} style={style}>{children}</Lens>;
  return <div className={cn("tlf-surf", `tlf-surf--${mat}`, contrast && "tlf-surf--contrast", className)} style={{ borderRadius: radius, ...style }}>{children}</div>;
}

/* ── travelling selection (one continuous glass pill) ───────────────────────── */
export type SelItem<T extends string> = { value: T; label?: ReactNode; icon?: ReactNode; "aria-label"?: string };
export function TravellingSelection<T extends string>({ items, value, onChange, ariaLabel, variant = "segmented", size = "md" }: {
  items: SelItem<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string; variant?: "segmented" | "tabs"; size?: "sm" | "md";
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
    const t = setTimeout(measure, 60);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);
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
      data-rt={reducedTransparency || undefined} data-contrast={contrast || undefined} onKeyDown={onKey}>
      <span className="tlf-sel-pill" aria-hidden style={{ transform: `translate(${left}px, ${box.top}px)`, width, height: box.height }}><span className="tlf-sel-pill-face" /></span>
      {items.map((it, i) => (
        <button key={it.value} data-idx={i} role="tab" aria-selected={i === idx} aria-label={it["aria-label"]} tabIndex={i === idx ? 0 : -1}
          className="tlf-sel-opt" data-on={i === idx || undefined} onClick={() => onChange(it.value)}>
          {it.icon && <span className="tlf-sel-ico">{it.icon}</span>}
          {it.label != null && <span>{it.label}</span>}
        </button>
      ))}
    </div>
  );
}
