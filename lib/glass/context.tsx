"use client";
// Design Lab — client-side glass picks store. Ellis-only in practice
// (server sends empty picks for anyone else), so the provider is safe
// to mount for every agent-surface visitor.
// 2026-08-08.

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { updateGlassPicksAction } from "@/app/actions/agent-preferences";
import { DEFAULT_VARIANT, isGlassVariantId, type GlassVariantId } from "./variants";

export type GlassPicks = Record<string, GlassVariantId>;

type Ctx = {
  picks: GlassPicks;
  /** Change one card's variant. Persists to server in background. */
  setPick: (glassId: string, variant: GlassVariantId) => void;
  /** Clear all picks — every tagged card returns to its defaultVariant. */
  resetAll: () => void;
};

const GlassCtx = createContext<Ctx>({
  picks: {},
  setPick: () => {},
  resetAll: () => {},
});

export function GlassPicksProvider({
  initialPicks,
  children,
}: {
  initialPicks: GlassPicks;
  children: React.ReactNode;
}) {
  const [picks, setPicks] = useState<GlassPicks>(() => sanitise(initialPicks));

  const setPick = useCallback((glassId: string, variant: GlassVariantId) => {
    setPicks((prev) => {
      const next: GlassPicks = { ...prev };
      if (variant === DEFAULT_VARIANT) {
        // v00 is the fallback — no reason to persist it. Keeps the JSON
        // small and lets "reset one card" work by picking v00.
        delete next[glassId];
      } else {
        next[glassId] = variant;
      }
      // Fire-and-forget — the DOM is already updated via context state
      // above. If the server rejects we log; user's next reload will
      // re-hydrate from whatever the DB has. Not worth blocking on.
      updateGlassPicksAction(next).catch((err) => {
        console.error("[GlassPicks] persist failed:", err);
      });
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setPicks({});
    updateGlassPicksAction({}).catch((err) => {
      console.error("[GlassPicks] reset failed:", err);
    });
  }, []);

  const value = useMemo(() => ({ picks, setPick, resetAll }), [picks, setPick, resetAll]);

  return <GlassCtx.Provider value={value}>{children}</GlassCtx.Provider>;
}

/** Reads the whole store (drawer / debug consumers). */
export function useGlassPicks() {
  return useContext(GlassCtx);
}

/** Reads the current pick for one card. Returns undefined when unset;
 *  GlassCard falls back to its defaultVariant. */
export function usePickForCard(glassId: string): GlassVariantId | undefined {
  return useContext(GlassCtx).picks[glassId];
}

// Drop any keys that don't map to a known variant. Defensive — protects
// against stale keys after a variant is renamed / removed in a future
// pass. Runs once on mount.
function sanitise(input: GlassPicks): GlassPicks {
  const clean: GlassPicks = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof k === "string" && isGlassVariantId(v) && v !== DEFAULT_VARIANT) {
      clean[k] = v;
    }
  }
  return clean;
}
