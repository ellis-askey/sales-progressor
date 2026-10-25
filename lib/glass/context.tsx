"use client";
// Design Lab — client-side glass picks store. Ellis-only in practice
// (server sends empty picks for anyone else), so the provider is safe
// to mount for every agent-surface visitor.
//
// 2026-08-10: picks are now PER MODE. Each card holds an optional light
// pick and an optional dark pick; the store resolves the one matching the
// active <html data-theme> so a card can look one way in light and another
// in dark. setPick writes the CURRENT mode's slot; flip the theme (e.g. via
// the drawer's toggle) to edit the other mode.

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { updateGlassPicksAction, updateGlassStylesAction } from "@/app/actions/agent-preferences";
import {
  DEFAULT_VARIANT,
  isGlassVariantId,
  type GlassMode,
  type GlassPick,
  type GlassPicks,
} from "./variants";
import { DEFAULT_PICKS } from "./default-picks";
import { glassStylesCss, isCustomStyleId, parseGlassStyles, recipeToCssBody, type GlassStyle, type GlassRecipe } from "./custom";

type Preview = { glassId: string; mode: GlassMode; recipe: GlassRecipe } | null;

export type { GlassMode, GlassPick, GlassPicks };
export type { GlassStyle, GlassRecipe } from "./custom";

type Ctx = {
  picks: GlassPicks;
  /** Ellis's saved custom glass styles (named recipes). */
  styles: GlassStyle[];
  /** Active mode, mirrors <html data-theme> — drives the live preview. */
  mode: GlassMode;
  /** Change one card's pick (a variant "vNN" or a custom style "cs-…") for a
   *  given mode (defaults to the active mode). Persists in background. */
  setPick: (glassId: string, value: string, targetMode?: GlassMode) => void;
  /** Create or update a saved custom style. */
  saveStyle: (style: GlassStyle) => void;
  /** Delete a saved custom style. */
  deleteStyle: (id: string) => void;
  /** Transient live-edit preview (not persisted): forces one card+mode to
   *  render the given recipe as `.glass-cs-preview` while the editor is open. */
  preview: Preview;
  setPreview: (p: Preview) => void;
  /** Clear all picks (both modes) — every tagged card returns to its default. */
  resetAll: () => void;
};

const GlassCtx = createContext<Ctx>({
  picks: {},
  styles: [],
  mode: "light",
  setPick: () => {},
  saveStyle: () => {},
  deleteStyle: () => {},
  preview: null,
  setPreview: () => {},
  resetAll: () => {},
});

function readMode(): GlassMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function GlassPicksProvider({
  initialPicks,
  initialStyles = [],
  children,
}: {
  initialPicks: GlassPicks;
  initialStyles?: GlassStyle[];
  children: React.ReactNode;
}) {
  const [picks, setPicks] = useState<GlassPicks>(() => sanitise(initialPicks));
  const [styles, setStyles] = useState<GlassStyle[]>(() => parseGlassStyles(initialStyles));
  const [preview, setPreviewState] = useState<Preview>(null);
  const [mode, setModeState] = useState<GlassMode>(readMode);
  const setPreview = useCallback((p: Preview) => setPreviewState(p), []);

  // Track the active theme so usePickForCard resolves the right slot and
  // re-renders every tagged card the instant the theme flips.
  useEffect(() => {
    const read = () => setModeState(readMode());
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const setPick = useCallback(
    (glassId: string, value: string, targetMode: GlassMode = mode) => {
      setPicks((prev) => {
        const next: GlassPicks = { ...prev };
        const entry: GlassPick = { ...(next[glassId] ?? {}) };
        if (value === DEFAULT_VARIANT) {
          // v00 is the fallback — clear this mode's slot (reset one card/mode).
          delete entry[targetMode];
        } else {
          entry[targetMode] = value;
        }
        if (!entry.light && !entry.dark) delete next[glassId];
        else next[glassId] = entry;
        updateGlassPicksAction(next).catch((err) => {
          console.error("[GlassPicks] persist failed:", err);
        });
        return next;
      });
    },
    [mode],
  );

  const saveStyle = useCallback((style: GlassStyle) => {
    setStyles((prev) => {
      const next = prev.some((s) => s.id === style.id)
        ? prev.map((s) => (s.id === style.id ? style : s))
        : [...prev, style];
      updateGlassStylesAction(next).catch((err) => console.error("[GlassStyles] persist failed:", err));
      return next;
    });
  }, []);

  const deleteStyle = useCallback((id: string) => {
    setStyles((prev) => {
      const next = prev.filter((s) => s.id !== id);
      updateGlassStylesAction(next).catch((err) => console.error("[GlassStyles] delete failed:", err));
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setPicks({});
    updateGlassPicksAction({}).catch((err) => {
      console.error("[GlassPicks] reset failed:", err);
    });
  }, []);

  const value = useMemo(
    () => ({ picks, styles, mode, setPick, saveStyle, deleteStyle, preview, setPreview, resetAll }),
    [picks, styles, mode, setPick, saveStyle, deleteStyle, preview, setPreview, resetAll],
  );

  const css =
    glassStylesCss(styles) +
    (preview ? `\n[data-glass-id].glass-cs-preview {\n${recipeToCssBody(preview.recipe)}\n}` : "");

  return (
    <GlassCtx.Provider value={value}>
      {/* Saved custom styles (+ the transient editor preview) compile to
          `.glass-cs-…` rules. Rendered here so SSR has them on first paint AND
          live edits update every tagged surface instantly. */}
      <style data-glass-custom dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </GlassCtx.Provider>
  );
}

/** Reads the whole store (drawer / debug consumers). */
export function useGlassPicks() {
  return useContext(GlassCtx);
}

/** Current-mode pick for one card. Returns undefined when unset for this mode;
 *  GlassCard falls back to its defaultVariant. */
export function usePickForCard(glassId: string): string | undefined {
  const { picks, mode, preview } = useContext(GlassCtx);
  // Live editor preview wins for the card being edited.
  if (preview && preview.glassId === glassId && preview.mode === mode) return "cs-preview";
  // User's own pick wins; otherwise the app-wide per-mode default (if any).
  return picks[glassId]?.[mode] ?? DEFAULT_PICKS[glassId]?.[mode];
}

// Drop any keys / values that don't validate — a value is a built-in variant
// OR a custom style id. Defensive against stale rows after a variant/style is
// renamed or removed. Runs once on mount.
function sanitise(input: GlassPicks): GlassPicks {
  const valid = (x: unknown): x is string => (isGlassVariantId(x) || isCustomStyleId(x)) && x !== DEFAULT_VARIANT;
  const clean: GlassPicks = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof k !== "string" || !k || !v || typeof v !== "object") continue;
    const entry: GlassPick = {};
    if (valid(v.light)) entry.light = v.light;
    if (valid(v.dark)) entry.dark = v.dark;
    if (entry.light || entry.dark) clean[k] = entry;
  }
  return clean;
}
