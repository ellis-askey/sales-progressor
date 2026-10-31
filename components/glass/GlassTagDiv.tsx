"use client";

// A thin client wrapper that makes a plain <div> Design-Lab-selectable via
// useGlassTag — for use inside SERVER components (which can't call the hook
// themselves). Spreads the tag props + appends the glass class; `surfaceClassName`
// holds the base background/border utilities and is dropped once a variant is
// picked so the glass owns the surface (mirrors the inline `picked` gate pattern).

import type { ReactNode, HTMLAttributes } from "react";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import type { GlassPick } from "@/lib/glass/variants";

export function GlassTagDiv({
  glassId,
  label,
  className = "",
  surfaceClassName = "",
  baseline,
  children,
  ...rest
}: {
  glassId: string;
  label: string;
  className?: string;
  surfaceClassName?: string;
  // Baked "for everybody" default for this surface (same role as the baseline
  // arg on useGlassTag). Keep the element's border-radius in `className`, NOT
  // `surfaceClassName` — the latter is dropped once a pick/baseline is active,
  // so a radius left there squares the corners when baked.
  baseline?: GlassPick;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const tag = useGlassTag(glassId, label, baseline);
  return (
    <div
      {...rest}
      {...tag.props}
      className={`${className} ${tag.picked ? "" : surfaceClassName} ${tag.className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </div>
  );
}
