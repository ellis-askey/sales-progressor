"use client";

// components/ui/FieldStack.tsx
//
// Canonical vertical container for stacked floating-label fields (LabelInput).
//
// Why this exists: LabelInput's label lifts ONTO the field's top border when
// focused/filled, overhanging the box by a few px. The dense "sm" preset
// reserves no top padding (topGap 0), so a naive tight gap lets a lower field's
// lifted label crowd the field above: the recurring "needs a few extra pixels
// when the title is inside the border" paper-cut. This bakes the clearance once
// so callers never hand-tune it again.
//
// Use for any vertical run of LabelInputs. For a two-up grid of fields, pass
// `topGap` to each LabelInput instead (same clearance, reserved inside the box
// so the row stays aligned).

import type { CSSProperties, ReactNode } from "react";

/* The vertical gap that clears an sm field's lifted-label overhang (~6px) with
   breathing room. Matches the roominess of the md preset's built-in top pad. */
export const FIELD_STACK_GAP = 16;

export function FieldStack({
  children,
  gap = FIELD_STACK_GAP,
  className,
  style,
}: {
  children: ReactNode;
  /* override the baked clearance gap (px) for a tighter or looser run */
  gap?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {children}
    </div>
  );
}
