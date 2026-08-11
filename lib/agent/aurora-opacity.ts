// Per-user aurora (moving background) intensity — an integer 0–100.
// 100 = full aurora, 0 = off (the flat page background shows). Stored on
// User.agentPreferences.auroraOpacity and applied as the CSS custom property
// `--aurora-opacity` (0–1) on <html>, which fades the AppBackground canvas.
// The fade lives on the background element (a sibling of page content), so it
// never severs card backdrop-filter the way a page-level opacity would.
// 2026-08-11.

export const DEFAULT_AURORA_OPACITY = 100;

export function clampAuroraOpacity(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_AURORA_OPACITY;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function readAuroraOpacityFromPrefs(prefs: unknown): number {
  if (prefs && typeof prefs === "object" && "auroraOpacity" in prefs) {
    return clampAuroraOpacity((prefs as { auroraOpacity: unknown }).auroraOpacity);
  }
  return DEFAULT_AURORA_OPACITY;
}
