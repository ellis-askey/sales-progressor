// Design-bench option catalogue + persistence for the /dev/sheets surface +
// footer picker. The picker trials these on the real Drawer / Modal primitives
// (via their surfaceVariant / footerVariant props) so a winner can be baked in
// as the default and inherited by every drawer/modal at once.

import type { GlassVariantId } from "@/lib/glass/variants";
import type { DesignSelection } from "./types";
import { DEFAULT_PRESET_ID, getPreset } from "./presets";

export type DesignByMode = { light: DesignSelection; dark: DesignSelection };

// Dark-mode header treatments — the Ribbon layout kept, but the bright coral
// band swapped for something that reads on dark. `bg` is a CSS background,
// `kicker` the kicker colour (title/subtitle stay white). "edge" leans on the
// primitive's coral top-accent line for its brand cue.
export type DarkHeaderOption = { id: string; label: string; blurb: string; bg: string; kicker: string };
export const DARK_HEADERS: DarkHeaderOption[] = [
  { id: "slate",  label: "Slate",       blurb: "Dark slate band · coral kicker",              bg: "#1E293B", kicker: "var(--agent-coral)" },
  { id: "deep",   label: "Deep",        blurb: "Near-black band · blends into the card top",  bg: "#0D1421", kicker: "var(--agent-coral)" },
  { id: "tint",   label: "Coral wash",  blurb: "Dark band with a soft coral wash",            bg: "linear-gradient(135deg, rgba(255,107,74,0.24) 0%, rgba(30,41,59,0.55) 62%)", kicker: "var(--agent-coral)" },
  { id: "muted",  label: "Muted coral", blurb: "Deep desaturated coral · brand, not bright",  bg: "#833d2a", kicker: "rgba(255,255,255,0.82)" },
  { id: "edge",   label: "Coral edge",  blurb: "Header matches the card · coral top line only", bg: "#161d2e", kicker: "var(--agent-coral)" },
];
export const DEFAULT_DARK_HEADER = "slate";
export function getDarkHeader(id: string | undefined): DarkHeaderOption {
  return DARK_HEADERS.find((h) => h.id === id) ?? DARK_HEADERS[0];
}

const defaultPreset = getPreset(DEFAULT_PRESET_ID);
export const DEFAULT_SELECTION: DesignSelection = {
  presetId: DEFAULT_PRESET_ID,
  surfaceVariant: defaultPreset.surfaceVariant,
  footerVariant: defaultPreset.footerVariant,
};

// Applying a preset sets all three fields at once (surface/footer can then be
// fine-tuned without losing the preset's interior skin).
export function selectionFromPreset(id: string): DesignSelection {
  const p = getPreset(id);
  return { presetId: p.id, surfaceVariant: p.surfaceVariant, footerVariant: p.footerVariant };
}
export const DEFAULT_BY_MODE: DesignByMode = {
  light: { ...DEFAULT_SELECTION },
  dark: { ...DEFAULT_SELECTION, headerStyleId: DEFAULT_DARK_HEADER },
};

export type SurfaceOption = {
  // null = the primitive's current hardcoded surface.
  id: GlassVariantId | null;
  label: string;
  group: "Current" | "Glass" | "Solid" | "New";
  // Restyled 2026-09-03 from a never-used variant — surfaced as a fresh candidate.
  isNew?: boolean;
};

// The candidates the picker offers. The good existing glass looks + two solids
// + the four restyled "New" surfaces. Order = display order within each group.
export const SURFACE_OPTIONS: SurfaceOption[] = [
  { id: null, label: "Current", group: "Current" },

  { id: "v03", label: "Standard glass", group: "Glass" },
  { id: "v04", label: "Thin glass", group: "Glass" },
  { id: "v05", label: "Heavy frost", group: "Glass" },
  { id: "v06", label: "Vibrant", group: "Glass" },

  { id: "v01", label: "Clean solid", group: "Solid" },
  { id: "v09", label: "Warm solid", group: "Solid", isNew: true },

  { id: "v12", label: "Sharp glass", group: "New", isNew: true },
  { id: "v13", label: "Pillow glass", group: "New", isNew: true },
  { id: "v17", label: "Deep frost", group: "New", isNew: true },
  { id: "v24", label: "Specular edge", group: "New", isNew: true },
];

export const SURFACE_GROUP_ORDER: SurfaceOption["group"][] = ["Current", "Glass", "Solid", "New"];

export const FOOTER_OPTIONS: { id: DesignSelection["footerVariant"]; label: string }[] = [
  { id: "default", label: "Current" },
  { id: "glass", label: "Glass bar" },
];

// ── Persistence (localStorage, /sheets-scoped) ───────────────────────────────

const KEY = "sp:dev-sheets:design:v1";

export function loadDesign(): DesignByMode {
  if (typeof window === "undefined") return DEFAULT_BY_MODE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BY_MODE;
    const parsed = JSON.parse(raw) as Partial<DesignByMode>;
    return {
      light: { ...DEFAULT_SELECTION, ...(parsed.light ?? {}) },
      dark: { ...DEFAULT_SELECTION, headerStyleId: DEFAULT_DARK_HEADER, ...(parsed.dark ?? {}) },
    };
  } catch {
    return DEFAULT_BY_MODE;
  }
}

export function saveDesign(next: DesignByMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — selection just won't persist */
  }
}
