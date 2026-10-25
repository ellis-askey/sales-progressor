"use client";

import { useGlassPicks } from "./context";
import { classFor, DEFAULT_VARIANT, type GlassPick } from "./variants";

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
//
// `picked` tells the consumer whether a variant is active. Use it on surfaces
// styled with INLINE styles (which beat any class, so the variant can't show):
// drop the inline background/border/shadow when `picked` so the glass variant
// owns the surface, e.g.
//   style={{ ...layout, ...(tag.picked ? {} : { background, border }) }}
//
// `baseline` is an OPTIONAL per-call baked default — the "for everybody" look
// for this surface once Ellis has perfected it (a variant "vNN" or a custom
// style "cs-…" per mode). It's applied only when the user has no own pick, so a
// user can still override it in the Design Lab. This is deliberately a per-call
// arg, NOT the global DEFAULT_PICKS: a tag honours only the baseline its own
// component passes, so baking one page can't silently restyle tagged surfaces
// on another page that happen to share a DEFAULT_PICKS entry.
export function useGlassTag(
  glassId: string,
  label: string,
  baseline?: GlassPick,
): {
  className: string;
  picked: boolean;
  props: {
    "data-glass-id": string;
    "data-glass-label": string;
    "data-glass-variant": string;
  };
} {
  const { picks, mode, preview } = useGlassPicks();
  const resolved =
    preview && preview.glassId === glassId && preview.mode === mode
      ? "cs-preview"
      : picks[glassId]?.[mode] ?? baseline?.[mode];
  return {
    // No pick and no baseline → no glass class → the element is unchanged.
    className: resolved ? classFor(resolved) : "",
    picked: !!resolved,
    props: {
      "data-glass-id": glassId,
      "data-glass-label": label,
      "data-glass-variant": resolved ?? DEFAULT_VARIANT,
    },
  };
}
