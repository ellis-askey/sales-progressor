"use client";

// Portal-nav lab — shared kit: types, data, the settings context, the glass
// material (real SVG refraction vs frosted fallback) and a spring hook. All of
// this is /dev-only and imports the EXISTING in-house engines — it changes
// nothing in production.
//   · Refraction:  components/quick-dock/LiquidGlass.tsx (feImage → feDisplacementMap
//                  on backdrop-filter, 3-pass chromatic aberration). Chromium only.
//   · Springs:     components/liquid/lib/spring.ts (response/bounce model + rAF loop).

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { House, ClockCounterClockwise, ChatCircle } from "@phosphor-icons/react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";
import { createSpring, retuneSpring, stepSpring, createFrameLoop, motionReduced, type Spring } from "@/components/liquid/lib/spring";

type PhIcon = typeof House;

// ─── Destinations (the real portal's three) ─────────────────────────────────────
export type TabKey = "overview" | "progress" | "updates";
export type Tab = { key: TabKey; label: string; Icon: PhIcon; badge?: number };
export const TABS: Tab[] = [
  { key: "overview", label: "Overview", Icon: House },
  { key: "progress", label: "Progress", Icon: ClockCounterClockwise },
  { key: "updates", label: "Updates", Icon: ChatCircle, badge: 2 },
];

export const ACCENTS = [
  { id: "coral", label: "TSP coral", value: "#FF6B4A" },
  { id: "blue", label: "Blue", value: "#0A84FF" },
  { id: "green", label: "Green", value: "#2FB46B" },
  { id: "violet", label: "Violet", value: "#7C5CFF" },
  { id: "ink", label: "Graphite", value: "#3b4254" },
];

// Backgrounds to stress-test the glass against (flat gradients lie; real content
// is the honest test). Each is a CSS background value or a sentinel handled by
// the stage.
export type BgMode = "gradient" | "photo" | "illustration" | "cards" | "dark" | "busy" | "content";
export const BACKGROUNDS: { id: BgMode; label: string }[] = [
  { id: "gradient", label: "Portal gradient" },
  { id: "photo", label: "Property photo" },
  { id: "illustration", label: "Illustration" },
  { id: "cards", label: "White cards" },
  { id: "dark", label: "Dark" },
  { id: "busy", label: "Busy / high-contrast" },
  { id: "content", label: "Live content" },
];

export type HideMode =
  | "always"
  | "hideDown"
  | "shrink"
  | "handle"
  | "iconsOnly"
  | "slideUnder"
  | "fade";
export const HIDE_MODES: { id: HideMode; label: string }[] = [
  { id: "always", label: "Always visible" },
  { id: "hideDown", label: "Hide on scroll down" },
  { id: "shrink", label: "Shrink on scroll" },
  { id: "handle", label: "Fade to handle" },
  { id: "iconsOnly", label: "Compress to icons" },
  { id: "slideUnder", label: "Slide under edge" },
  { id: "fade", label: "Fade while scrolling" },
];

export type Theme = "light" | "dark";

export type Settings = {
  theme: Theme;
  accent: string;
  bg: BgMode;
  // glass material
  advanced: boolean; // real refraction when supported
  blur: number; // frost blur (px)
  tint: number; // surface opacity 0..1
  displace: number; // refraction strength
  aberration: number; // chromatic spread (px)
  edge: number; // edge-highlight strength 0..1
  shadow: number; // shadow depth 0..1
  radius: number; // default corner radius
  // motion
  response: number; // spring response (s)
  bounce: number; // spring bounce 0..1
  // layout
  size: number; // nav scale 0.85..1.2
  edgeGap: number; // distance from the screen edge (px)
  // behaviour
  hideMode: HideMode;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  accent: ACCENTS[0].value,
  bg: "photo",
  advanced: true,
  blur: 18,
  tint: 0.5,
  displace: 64,
  aberration: 4,
  edge: 0.6,
  shadow: 0.5,
  radius: 24,
  response: 0.42,
  bounce: 0.22,
  size: 1,
  edgeGap: 20,
  hideMode: "hideDown",
};

// ─── Settings context ───────────────────────────────────────────────────────────
const SettingsCtx = createContext<Settings>(DEFAULT_SETTINGS);
export const useSettings = () => useContext(SettingsCtx);
export function SettingsProvider({ value, children }: { value: Settings; children: ReactNode }) {
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

// ─── Can this engine present real refraction? (url() in backdrop-filter) ─────────
export function useChromium(): boolean {
  // Mirror the proven detection in QuickActionDock: only Chromium/Edge can
  // present url() in backdrop-filter; iOS / Safari / Firefox fall back to frost.
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

// ─── Spring hook (one animated number) ──────────────────────────────────────────
export function useSpringValue(target: number, response?: number, bounce?: number): number {
  const s = useSettings();
  const resp = response ?? s.response;
  const bnc = bounce ?? s.bounce;
  const [val, setVal] = useState(target);
  const spring = useRef<Spring | null>(null);
  const loop = useRef<{ start(): void; stop(): void } | null>(null);
  if (spring.current === null) spring.current = createSpring(resp, bnc, target);
  useEffect(() => {
    const sp = spring.current;
    if (!sp) return;
    sp.target = target;
    retuneSpring(sp, resp, bnc);
    if (!loop.current) {
      loop.current = createFrameLoop((dt) => {
        const cont = stepSpring(sp, dt, motionReduced());
        setVal(sp.value);
        return cont;
      });
    }
    loop.current.start();
  }, [target, resp, bnc]);
  useEffect(() => () => loop.current?.stop(), []);
  return val;
}

// ─── Glass helpers ──────────────────────────────────────────────────────────────
export function tintColor(theme: Theme, alpha: number): string {
  return theme === "dark" ? `rgba(26,30,38,${alpha})` : `rgba(255,255,255,${alpha})`;
}

function MethodBadge({ real }: { real: boolean }) {
  return <span className="pnl-method" data-real={real ? "1" : undefined}>{real ? "Refraction" : "Frosted"}</span>;
}

// The material every nav sits on. Picks the real refraction engine when advanced
// effects are on AND the engine can present them; otherwise the frosted fallback.
// Both read their look from CSS vars set on .pnl-root from the live Settings.
type GlassProps = {
  radius?: number;
  className?: string;
  style?: CSSProperties;
  badge?: boolean; // show the rendering-method chip
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "style">;

export function GlassSurface({ radius, className = "", style, badge, children, ...rest }: GlassProps) {
  const s = useSettings();
  const chromium = useChromium();
  const real = s.advanced && chromium;
  const r = radius ?? s.radius;
  const tint = tintColor(s.theme, s.tint);

  if (real) {
    return (
      <LiquidGlass
        radius={r}
        blur={Math.max(0.5, s.blur / 14)}
        displace={s.displace}
        aberration={s.aberration}
        tint={tint}
        className={`pnl-surface pnl-surface--real ${className}`}
        style={{ boxShadow: "var(--pnl-shadow)", ...style }}
        {...rest}
      >
        {children}
        {badge && <MethodBadge real />}
      </LiquidGlass>
    );
  }
  return (
    <div
      className={`pnl-surface pnl-frost ${className}`}
      style={{ borderRadius: r, background: tint, ...style }}
      {...rest}
    >
      {children}
      {badge && <MethodBadge real={false} />}
    </div>
  );
}

// Small unread pip used by the Updates tab.
export function Unread({ n }: { n: number }) {
  return <span className="pnl-unread">{n}</span>;
}
