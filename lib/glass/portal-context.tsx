"use client";

// Portal glass picks store. Unlike the agent Design Lab (per-user, light+dark),
// the portal store is GLOBAL and single-mode (the portal is light-only): one
// variant per tagged surface, applied to every client. Founder edits write
// through updatePortalGlassPicksAction (which re-checks the founder gate on the
// server). `canEdit` only decides whether the flask + dropdowns render — reads
// are the same for everyone so clients see the picks live.

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { isGlassVariantId, DEFAULT_VARIANT, type GlassVariantId } from "./variants";
import { updatePortalGlassPicksAction } from "@/app/actions/portal-glass";

export type PortalGlassPicks = Record<string, GlassVariantId>;

type Ctx = {
  picks: PortalGlassPicks;
  canEdit: boolean;
  setPick: (glassId: string, variant: GlassVariantId) => void;
  resetAll: () => void;
};

const PortalGlassCtx = createContext<Ctx>({
  picks: {},
  canEdit: false,
  setPick: () => {},
  resetAll: () => {},
});

export function PortalGlassProvider({
  initialPicks,
  canEdit,
  children,
}: {
  initialPicks: PortalGlassPicks;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [picks, setPicks] = useState<PortalGlassPicks>(() => sanitise(initialPicks));

  const setPick = useCallback((glassId: string, variant: GlassVariantId) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (variant === DEFAULT_VARIANT) delete next[glassId];
      else next[glassId] = variant;
      updatePortalGlassPicksAction(next).catch((e) => console.error("[PortalGlass] persist failed", e));
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setPicks({});
    updatePortalGlassPicksAction({}).catch((e) => console.error("[PortalGlass] reset failed", e));
  }, []);

  const value = useMemo(() => ({ picks, canEdit, setPick, resetAll }), [picks, canEdit, setPick, resetAll]);

  return <PortalGlassCtx.Provider value={value}>{children}</PortalGlassCtx.Provider>;
}

export function usePortalGlass() {
  return useContext(PortalGlassCtx);
}

/** Current variant pick for one tagged surface, or undefined (renders default). */
export function usePortalPick(glassId: string): GlassVariantId | undefined {
  return useContext(PortalGlassCtx).picks[glassId];
}

function sanitise(input: PortalGlassPicks): PortalGlassPicks {
  const clean: PortalGlassPicks = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof k === "string" && k && isGlassVariantId(v) && v !== DEFAULT_VARIANT) clean[k] = v;
  }
  return clean;
}
