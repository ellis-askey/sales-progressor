"use client";

import { useGlassPicks } from "./context";
import { classFor, DEFAULT_VARIANT } from "./variants";

// Make an EXISTING, already-styled element pickable in the Design Lab WITHOUT
// changing how it looks today. Unlike <GlassCard> (which always applies a
// variant class), this returns a glass class ONLY once a pick exists — so with
// no pick the element keeps its own styling byte-for-byte, and the Design Lab
// still discovers it (via the data-glass-* attributes) so Ellis can assign a
// variant later. The chosen variant then layers on top.
//
// Usage — spread the props and append the className onto the existing element:
//   const tag = useGlassTag("enquiries-search", "Enquiries · search bar");
//   <div className={`enq-search ${tag.className}`} {...tag.props}>…</div>
//
// Share one glassId across repeated elements (e.g. every enquiry card) to get a
// single Lab row that drives them all — exactly how hub-attention works.
export function useGlassTag(
  glassId: string,
  label: string,
): {
  className: string;
  props: {
    "data-glass-id": string;
    "data-glass-label": string;
    "data-glass-variant": string;
  };
} {
  // Read ONLY the user's own pick for the active mode — deliberately NOT
  // usePickForCard (which also applies app-wide DEFAULT_PICKS). The whole point
  // of a tag is "unchanged until Ellis picks it", so a stale/aspirational
  // DEFAULT_PICKS entry for this id must not silently restyle the element.
  const { picks, mode } = useGlassPicks();
  const pick = picks[glassId]?.[mode];
  return {
    // No pick → no glass class → the element is visually unchanged.
    className: pick ? classFor(pick) : "",
    props: {
      "data-glass-id": glassId,
      "data-glass-label": label,
      "data-glass-variant": pick ?? DEFAULT_VARIANT,
    },
  };
}
