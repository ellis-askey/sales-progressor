"use client";

// GlassLens — the Design Lab's live slab-lens pick, rendered as an inset layer
// behind a tagged surface's content. The "lens" variant can't be a CSS class
// (it needs a per-element SVG displacement filter sized at runtime), so instead
// of swapping the element we drop a LiquidLens layer inside it.
//
// Host wiring (done by the consumer when `tag.lens` is true):
//   - background: transparent  (so the page shows through to the lens)
//   - isolation: isolate       (contains the z-index:-1 layer in a stacking ctx)
//   - position: relative       (only if the host isn't already positioned)
// The layer sits at z-index:-1, so it paints above the host's (now transparent)
// background but below its text/icons — no content lifting needed.

import { LiquidLens } from "@/components/liquid/LiquidLens";
import type { RefractionStrength } from "@/components/liquid/lib/refraction-map";

export function GlassLens({
  radius = 16,
  strength = "strong",
  thickness = 1.3,
}: {
  radius?: number;
  strength?: RefractionStrength;
  thickness?: number;
}) {
  return (
    <LiquidLens
      radius={radius}
      strength={strength}
      thickness={thickness}
      aria-hidden
      className="glass-lens-layer"
      style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
}
