"use client";
// Shell Glass Lab · live-tunable glass for the EXPERIMENTAL agent shell's chrome
// (the floating capsule / left drawer / compact bar, rendered by AgxGlass).
// Ellis-only, desktop-only: dial a look, then tell us what to bake into
// AgentShellExperimental.tsx.
//
// This covers the ACTUAL "set ways of doing glass" from the /dev pages · which
// span THREE engines, not one:
//   · canvas · <LiquidGlass>  (quick-dock/LiquidGlass): displacement + chromatic
//     aberration. The shipped shell look + the design-system Card/Panel/Raised ramp.
//   · lens   · <LiquidLens>   (components/liquid): SVG slab-lens optics. The
//     glass-foundry V0/V1 looks. Knobs are strength + a thickness MULTIPLIER.
//   · css    · flat CSS materials (.agx-mat-frost/clear/edge), ported verbatim
//     from glass-foundry's V2/V3/V4 (.gf-frost/.gf-clear/.gf-edge).
//
// A "material" is one named look; selecting it loads its full recipe, which the
// sliders then fine-tune. Persistence is localStorage only (personal preview, no
// DB). SSR starts from the shipped defaults so first paint matches today.

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

export type ShellGlassEngine = "canvas" | "lens" | "css";
export type ShellGlassMaterial =
  | "lg-shipped" | "lg-card" | "lg-panel" | "lg-raised" | "lg-strong"
  | "lens-v0" | "lens-v1"
  | "css-frost" | "css-clear" | "css-edge";

export function engineOf(m: ShellGlassMaterial): ShellGlassEngine {
  if (m.startsWith("lens-")) return "lens";
  if (m.startsWith("css-")) return "css";
  return "canvas";
}
/** "css-frost" → "frost" (the .agx-mat-<key> class suffix). */
export function cssKeyOf(m: ShellGlassMaterial): "frost" | "clear" | "edge" {
  return (m.startsWith("css-") ? m.slice(4) : "frost") as "frost" | "clear" | "edge";
}

export type ShellGlassSettings = {
  /** Which named look is active (also picks the render engine). */
  material: ShellGlassMaterial;
  // ── canvas (LiquidGlass) ──
  blur: number;        // residual frost blur, px
  displace: number;    // displacement strength (the bend)
  thickness: number;   // refracting rim band, px
  aberration: number;  // chromatic spread, px (0 = off)
  // ── lens (LiquidLens) ──
  lensStrength: "soft" | "strong";
  lensThickness: number;    // rim MULTIPLIER (~0.1–4), NOT px
  lensDisplacement: number; // displacement override; 0 = auto (engine default)
  lensBlur: number;         // extra blur on the lens, px
  // ── shared ──
  radiusScale: number;      // ×corner radius (1 = shipped)
  tintLight: string;        // rgba() · alpha is the "fade" (canvas + lens)
  tintDark: string;         // rgba()
  frostBlur: number;        // Safari/Firefox/iOS fallback blur, px
};

// Field defaults used to fill any gap when a material only specifies some knobs.
const BASE: Omit<ShellGlassSettings, "material"> = {
  blur: 1.5, displace: 42, thickness: 14, aberration: 4,
  lensStrength: "strong", lensThickness: 1.3, lensDisplacement: 0, lensBlur: 0,
  radiusScale: 1,
  tintLight: "rgba(255, 255, 255, 0.64)", tintDark: "rgba(34, 37, 50, 0.58)",
  frostBlur: 30,
};

// Each named look = BASE + its defining knobs, verbatim from the /dev pages.
export type ShellGlassMaterialDef = { id: ShellGlassMaterial; label: string; engine: ShellGlassEngine; note: string; settings: ShellGlassSettings };
const mk = (id: ShellGlassMaterial, label: string, note: string, over: Partial<ShellGlassSettings>): ShellGlassMaterialDef =>
  ({ id, label, engine: engineOf(id), note, settings: { material: id, ...BASE, ...over } });

export const SHELL_GLASS_MATERIALS: ShellGlassMaterialDef[] = [
  // ── canvas · LiquidGlass ──────────────────────────────────────────────────
  mk("lg-shipped", "Liquid Glass · Shipped", "Today's live shell look.", { blur: 22, tintLight: "rgba(255, 255, 255, 1)", tintDark: "rgba(0, 0, 0, 0.78)" }),
  mk("lg-card", "Liquid Glass · Card", "Soft, barely refracting (design-system Card).", { displace: 30, thickness: 14, aberration: 1, tintLight: "rgba(255, 255, 255, 0.52)", tintDark: "rgba(32, 35, 47, 0.44)" }),
  mk("lg-panel", "Liquid Glass · Panel", "Mid refraction (design-system Panel).", { displace: 46, thickness: 12, aberration: 4, tintLight: "rgba(255, 255, 255, 0.56)", tintDark: "rgba(26, 29, 40, 0.50)" }),
  mk("lg-raised", "Liquid Glass · Raised", "Thick, strong aberration · hero/floating (design-system Raised).", { displace: 70, thickness: 18, aberration: 10, tintLight: "rgba(255, 255, 255, 0.74)", tintDark: "rgba(38, 41, 54, 0.66)" }),
  mk("lg-strong", "Liquid Glass · Strong lens", "The showy draggable lens (dev/liquid-glass).", { blur: 1, displace: 120, thickness: 30, aberration: 10, tintLight: "rgba(255, 255, 255, 0.05)", tintDark: "rgba(255, 255, 255, 0.05)" }),
  // ── lens · LiquidLens (slab optics) ───────────────────────────────────────
  mk("lens-v0", "Slab lens V0 · Current", "The shipping slab lens (foundry V0).", { lensStrength: "strong", lensThickness: 1.3, lensDisplacement: 0, tintLight: "rgba(255, 255, 255, 0.12)", tintDark: "rgba(255, 255, 255, 0.06)" }),
  mk("lens-v1", "Slab lens V1 · Refined", "Deeper refined displacement (foundry V1).", { lensStrength: "strong", lensThickness: 1.6, lensDisplacement: 120, tintLight: "rgba(255, 255, 255, 0.05)", tintDark: "rgba(255, 255, 255, 0.05)" }),
  // ── css · flat materials ──────────────────────────────────────────────────
  mk("css-frost", "CSS V2 · Frosted vibrancy", "Strong blur + saturation, no refraction (foundry V2).", {}),
  mk("css-clear", "CSS V3 · Clear glass", "High translucency, minimal blur (foundry V3).", {}),
  mk("css-edge", "CSS V4 · Edge-lit thin", "Near-clear centre, bright refractive rim (foundry V4).", {}),
];

export const SHELL_GLASS_DEFAULTS: ShellGlassSettings =
  SHELL_GLASS_MATERIALS.find((m) => m.id === "lg-shipped")!.settings;

export function materialDef(id: ShellGlassMaterial): ShellGlassMaterialDef {
  return SHELL_GLASS_MATERIALS.find((m) => m.id === id) ?? SHELL_GLASS_MATERIALS[0];
}

type Ctx = {
  settings: ShellGlassSettings;
  patch: (p: Partial<ShellGlassSettings>) => void;
  applyMaterial: (id: ShellGlassMaterial) => void;
  reset: () => void;
};

const STORE_KEY = "agx-glass";
const MATERIAL_IDS = new Set(SHELL_GLASS_MATERIALS.map((m) => m.id));

const ShellGlassCtx = createContext<Ctx>({
  settings: SHELL_GLASS_DEFAULTS,
  patch: () => {},
  applyMaterial: () => {},
  reset: () => {},
});

function clampNum(v: unknown, fb: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, typeof v === "number" && isFinite(v) ? v : fb));
}
function sanitise(raw: unknown): ShellGlassSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rgba = (v: unknown, fb: string) => (typeof v === "string" && /^rgba?\(/i.test(v.trim()) ? v.trim() : fb);
  const material = (MATERIAL_IDS.has(o.material as ShellGlassMaterial) ? o.material : "lg-shipped") as ShellGlassMaterial;
  return {
    material,
    blur: clampNum(o.blur, BASE.blur, 0, 24),
    displace: clampNum(o.displace, BASE.displace, 0, 140),
    thickness: clampNum(o.thickness, BASE.thickness, 2, 48),
    aberration: clampNum(o.aberration, BASE.aberration, 0, 24),
    lensStrength: o.lensStrength === "soft" ? "soft" : "strong",
    lensThickness: clampNum(o.lensThickness, BASE.lensThickness, 0.1, 4),
    lensDisplacement: clampNum(o.lensDisplacement, BASE.lensDisplacement, 0, 180),
    lensBlur: clampNum(o.lensBlur, BASE.lensBlur, 0, 12),
    radiusScale: clampNum(o.radiusScale, BASE.radiusScale, 0.3, 2),
    tintLight: rgba(o.tintLight, BASE.tintLight),
    tintDark: rgba(o.tintDark, BASE.tintDark),
    frostBlur: clampNum(o.frostBlur, BASE.frostBlur, 0, 80),
  };
}

export function ShellGlassProvider({ children }: { children: React.ReactNode }) {
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
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const patch = useCallback(
    (p: Partial<ShellGlassSettings>) =>
      setSettings((prev) => { const next = sanitise({ ...prev, ...p }); persist(next); return next; }),
    [persist],
  );
  const applyMaterial = useCallback(
    (id: ShellGlassMaterial) =>
      setSettings(() => { const next = sanitise(materialDef(id).settings); persist(next); return next; }),
    [persist],
  );
  const reset = useCallback(() => { setSettings(SHELL_GLASS_DEFAULTS); persist(SHELL_GLASS_DEFAULTS); }, [persist]);

  const value = useMemo(() => ({ settings, patch, applyMaterial, reset }), [settings, patch, applyMaterial, reset]);
  return <ShellGlassCtx.Provider value={value}>{children}</ShellGlassCtx.Provider>;
}

export function useShellGlass(): Ctx {
  return useContext(ShellGlassCtx);
}
