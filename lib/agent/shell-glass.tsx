"use client";
// Shell Glass Lab — live-tunable settings for the EXPERIMENTAL agent shell's
// canvas glass (the floating capsule / left drawer / compact bar, all rendered
// by AgxGlass → LiquidGlass). Ellis-only, desktop-only: a personal preview tool
// to dial the Apple-refraction knobs and then tell us what to bake into
// AgentShellExperimental.tsx (the hardcoded LiquidGlass props + GLASS_TINT).
//
// Deliberately NOT the lib/glass pick/recipe engine — that drives the PRODUCTION
// shell's CSS `nav-topbar`/`nav-sidebar` surfaces. The experimental shell paints
// with the LiquidGlass canvas instead, whose knobs are displace/thickness/
// aberration/tint, not CSS blur/background. This store maps 1:1 onto those props.
//
// Persistence is localStorage only (like the shell switcher `agx-shell`) — it's a
// personal preview, no DB, no schema. SSR starts from the shipped defaults so
// first paint matches today; the saved tweak settles in after mount.

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

export type ShellGlassSettings = {
  /** residual frost blur layered on the refraction, px (LiquidGlass `blur`) */
  blur: number;
  /** displacement strength — how hard the rim bends the backdrop (`displace`) */
  displace: number;
  /** thickness of the refracting rim band, px (`thickness`) */
  thickness: number;
  /** chromatic-aberration spread, px — 0 = off (`aberration`) */
  aberration: number;
  /** multiplier applied to each surface's own corner radius (1 = shipped) */
  radiusScale: number;
  /** frosted-fallback blur for Safari/Firefox/iOS, px (`.agx-frost`) */
  frostBlur: number;
  /** glass body tint for light theme — rgba() string (alpha = the "fade") */
  tintLight: string;
  /** glass body tint for dark theme — rgba() string */
  tintDark: string;
};

// The shipped look, verbatim from AgentShellExperimental.tsx. Reset returns here,
// and an untouched export reads back exactly what's live in production today.
export const SHELL_GLASS_DEFAULTS: ShellGlassSettings = {
  blur: 1.5, // LiquidGlass default (AgxGlass doesn't pass one today)
  displace: 42,
  thickness: 14,
  aberration: 4,
  radiusScale: 1,
  frostBlur: 30,
  tintLight: "rgba(255, 255, 255, 0.64)",
  tintDark: "rgba(34, 37, 50, 0.58)",
};

// One-tap morph looks — the /dev/glass-foundry treatments translated into
// LiquidGlass params, so Ellis can A/B the different "ways of doing glass".
export type ShellGlassPreset = { id: string; label: string; note: string; settings: ShellGlassSettings };
export const SHELL_GLASS_PRESETS: ShellGlassPreset[] = [
  {
    id: "shipped",
    label: "Shipped",
    note: "Today's live look.",
    settings: SHELL_GLASS_DEFAULTS,
  },
  {
    id: "refined",
    label: "Refined refraction",
    note: "LiquidGlass's own tuning: deeper bend, wider rim (dev V1).",
    settings: { ...SHELL_GLASS_DEFAULTS, blur: 1.5, displace: 58, thickness: 18, aberration: 4 },
  },
  {
    id: "clear",
    label: "Clear glass",
    note: "High translucency, minimal frost (dev V3).",
    settings: { ...SHELL_GLASS_DEFAULTS, blur: 0.5, displace: 36, thickness: 12, aberration: 3, tintLight: "rgba(255, 255, 255, 0.42)", tintDark: "rgba(34, 37, 50, 0.40)" },
  },
  {
    id: "frosted",
    label: "Frosted vibrancy",
    note: "Strong blur, soft bend (dev V2).",
    settings: { ...SHELL_GLASS_DEFAULTS, blur: 5, displace: 20, thickness: 10, aberration: 2, tintLight: "rgba(255, 255, 255, 0.74)", tintDark: "rgba(34, 37, 50, 0.66)" },
  },
  {
    id: "edge",
    label: "Edge-lit thin",
    note: "Near-clear centre, bright refractive rim (dev V4).",
    settings: { ...SHELL_GLASS_DEFAULTS, blur: 1, displace: 66, thickness: 8, aberration: 7, tintLight: "rgba(255, 255, 255, 0.50)", tintDark: "rgba(34, 37, 50, 0.48)" },
  },
];

type Ctx = {
  settings: ShellGlassSettings;
  /** Patch one or more fields (live). Persists in background. */
  patch: (p: Partial<ShellGlassSettings>) => void;
  /** Apply a named preset wholesale. */
  applyPreset: (p: ShellGlassPreset) => void;
  /** Back to the shipped defaults. */
  reset: () => void;
};

const STORE_KEY = "agx-glass";

const ShellGlassCtx = createContext<Ctx>({
  settings: SHELL_GLASS_DEFAULTS,
  patch: () => {},
  applyPreset: () => {},
  reset: () => {},
});

function clampNum(v: unknown, fb: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, typeof v === "number" && isFinite(v) ? v : fb));
}
function sanitise(raw: unknown): ShellGlassSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rgba = (v: unknown, fb: string) =>
    typeof v === "string" && /^rgba?\(/i.test(v.trim()) ? v.trim() : fb;
  return {
    blur: clampNum(o.blur, SHELL_GLASS_DEFAULTS.blur, 0, 24),
    displace: clampNum(o.displace, SHELL_GLASS_DEFAULTS.displace, 0, 140),
    thickness: clampNum(o.thickness, SHELL_GLASS_DEFAULTS.thickness, 2, 48),
    aberration: clampNum(o.aberration, SHELL_GLASS_DEFAULTS.aberration, 0, 24),
    radiusScale: clampNum(o.radiusScale, SHELL_GLASS_DEFAULTS.radiusScale, 0.3, 2),
    frostBlur: clampNum(o.frostBlur, SHELL_GLASS_DEFAULTS.frostBlur, 0, 80),
    tintLight: rgba(o.tintLight, SHELL_GLASS_DEFAULTS.tintLight),
    tintDark: rgba(o.tintDark, SHELL_GLASS_DEFAULTS.tintDark),
  };
}

export function ShellGlassProvider({ children }: { children: React.ReactNode }) {
  // SSR + first paint: shipped look (no flash). localStorage settles in after mount.
  const [settings, setSettings] = useState<ShellGlassSettings>(SHELL_GLASS_DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setSettings(sanitise(JSON.parse(raw)));
    } catch {
      /* ignore malformed / unavailable storage */
    }
  }, []);

  const persist = useCallback((next: ShellGlassSettings) => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const patch = useCallback(
    (p: Partial<ShellGlassSettings>) =>
      setSettings((prev) => {
        const next = sanitise({ ...prev, ...p });
        persist(next);
        return next;
      }),
    [persist],
  );
  const applyPreset = useCallback(
    (preset: ShellGlassPreset) =>
      setSettings(() => {
        const next = sanitise(preset.settings);
        persist(next);
        return next;
      }),
    [persist],
  );
  const reset = useCallback(() => {
    setSettings(SHELL_GLASS_DEFAULTS);
    persist(SHELL_GLASS_DEFAULTS);
  }, [persist]);

  const value = useMemo(() => ({ settings, patch, applyPreset, reset }), [settings, patch, applyPreset, reset]);
  return <ShellGlassCtx.Provider value={value}>{children}</ShellGlassCtx.Provider>;
}

export function useShellGlass(): Ctx {
  return useContext(ShellGlassCtx);
}
