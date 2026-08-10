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
import { updateGlassPicksAction } from "@/app/actions/agent-preferences";
import {
  DEFAULT_VARIANT,
  isGlassVariantId,
  type GlassVariantId,
  type GlassMode,
  type GlassPick,
  type GlassPicks,
} from "./variants";

export type { GlassMode, GlassPick, GlassPicks };

type Ctx = {
  picks: GlassPicks;
  /** Active mode, mirrors <html data-theme>. */
  mode: GlassMode;
  /** Change one card's variant FOR THE CURRENT MODE. Persists in background. */
  setPick: (glassId: string, variant: GlassVariantId) => void;
  /** Clear all picks (both modes) — every tagged card returns to its default. */
  resetAll: () => void;
};

const GlassCtx = createContext<Ctx>({
  picks: {},
  mode: "light",
  setPick: () => {},
  resetAll: () => {},
});

function readMode(): GlassMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function GlassPicksProvider({
  initialPicks,
  children,
}: {
  initialPicks: GlassPicks;
  children: React.ReactNode;
}) {
  const [picks, setPicks] = useState<GlassPicks>(() => sanitise(initialPicks));
  const [mode, setModeState] = useState<GlassMode>(readMode);

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
    (glassId: string, variant: GlassVariantId) => {
      setPicks((prev) => {
        const next: GlassPicks = { ...prev };
        const entry: GlassPick = { ...(next[glassId] ?? {}) };
        if (variant === DEFAULT_VARIANT) {
          // v00 is the fallback — clear this mode's slot (reset one card/mode).
          delete entry[mode];
        } else {
          entry[mode] = variant;
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

  const resetAll = useCallback(() => {
    setPicks({});
    updateGlassPicksAction({}).catch((err) => {
      console.error("[GlassPicks] reset failed:", err);
    });
  }, []);

  const value = useMemo(() => ({ picks, mode, setPick, resetAll }), [picks, mode, setPick, resetAll]);

  return <GlassCtx.Provider value={value}>{children}</GlassCtx.Provider>;
}

/** Reads the whole store (drawer / debug consumers). */
export function useGlassPicks() {
  return useContext(GlassCtx);
}

/** Current-mode pick for one card. Returns undefined when unset for this mode;
 *  GlassCard falls back to its defaultVariant. */
export function usePickForCard(glassId: string): GlassVariantId | undefined {
  const { picks, mode } = useContext(GlassCtx);
  return picks[glassId]?.[mode];
}

// Drop any keys / variants that don't validate. Defensive against stale rows
// after a variant is renamed / removed. Runs once on mount.
function sanitise(input: GlassPicks): GlassPicks {
  const clean: GlassPicks = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof k !== "string" || !k || !v || typeof v !== "object") continue;
    const entry: GlassPick = {};
    if (isGlassVariantId(v.light) && v.light !== DEFAULT_VARIANT) entry.light = v.light;
    if (isGlassVariantId(v.dark) && v.dark !== DEFAULT_VARIANT) entry.dark = v.dark;
    if (entry.light || entry.dark) clean[k] = entry;
  }
  return clean;
}
