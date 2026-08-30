"use client";
// Design Lab — tag a card that already has its own surface class.
//
// GlassCard replaces a card's chrome with a glass-vNN variant, defaulting to
// v00. That flattens cards that today use the blurred agent-glass* surfaces.
// useCardSurface keeps the card's EXISTING surface until Ellis actually picks
// a variant in the Design Lab — so tagging a card changes nothing on screen
// until a pick exists, then swaps to the chosen glass-vNN. Discovery still
// works because we emit the data-glass-* attributes either way.
//
// Usage:
//   const { surfaceClass, tag } = useCardSurface("new-sale-notes", "New sale · Notes", "agent-glass-strong");
//   <div className={`${surfaceClass} overflow-hidden`} {...tag}>…</div>

import { usePickForCard } from "@/lib/glass/context";
import { classFor, DEFAULT_VARIANT } from "@/lib/glass/variants";

type SurfaceTag = {
  "data-glass-id": string;
  "data-glass-label": string;
  "data-glass-variant": string;
};

export function useCardSurface(
  glassId: string,
  label: string,
  baseSurfaceClass: string,
): { surfaceClass: string; tag: SurfaceTag; picked: boolean } {
  const pick = usePickForCard(glassId);
  return {
    // True when Ellis has chosen a variant — gradient/bespoke cards use this to
    // drop their own inline background so the picked glass surface shows.
    picked: !!pick,
    surfaceClass: pick ? classFor(pick) : baseSurfaceClass,
    tag: {
      "data-glass-id": glassId,
      "data-glass-label": label,
      "data-glass-variant": pick ?? DEFAULT_VARIANT,
    },
  };
}
