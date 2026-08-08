// Canonical Card primitive. Wraps the agent app's glass-card surface
// behind a typed React API. Replaces 56 inline `<div className="glass-card">`
// usages across domain folders (see docs/inventory/COMPONENTS.md).
//
// Phase 2 Week 4 of the discipline migration (see docs/BUILD_PLAN.md).
//
// Compound parts (Card.Header, Card.Body, Card.Footer) are intentionally
// NOT shipped in this PR — they require padding semantics that depend on
// the consumer surface. Phase 2 Week 4 ships the wrapper; sub-parts emerge
// from the first real surface remediation that needs them (Law 14).
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.1 for the catalog
// entry. Gallery story at app/dev/gallery/card/page.tsx.

import type { ReactNode, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import type { GlassVariantId } from "@/lib/glass/variants";

type Variant = "glass" | "solid";
type Padding = "none" | "sm" | "md" | "lg";

const paddingMap: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantMap: Record<Variant, string> = {
  // glass-card class is defined in app/globals.css line 127.
  // Backdrop-filter blur + gradient background + drop shadows.
  glass: "glass-card",
  // Solid white surface for use against light backdrops, or for
  // components that need predictable opacity (modals, tooltips
  // hosted inside Card).
  solid: "bg-white border border-slate-200",
};

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  padding?: Padding;
  // When true, applies hover + focus-within states. Used for cards that
  // act as links or whole-row click targets.
  interactive?: boolean;
  // Renders a subtle skeleton overlay. The Card stays visible underneath.
  loading?: boolean;
  // Design Lab tagging (2026-08-08). When glassId is set, the Card's
  // surface chrome is delegated to GlassCard so the card appears in the
  // Design Lab picker and honours Ellis's per-card variant picks. The
  // default variant is v03 (Standard glass), the closest catalog match
  // to the legacy glass-card look, so untouched cards render the same.
  // Note: ref forwarding is not supported in tagged mode (GlassCard
  // doesn't forward refs) — none of the tagged call sites use refs.
  glassId?: string;
  glassLabel?: string;
  glassDefault?: GlassVariantId;
  children?: ReactNode;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = "glass",
    padding = "md",
    interactive = false,
    loading = false,
    className = "",
    glassId,
    glassLabel,
    glassDefault,
    children,
    ...rest
  },
  ref,
) {
  const sharedClasses = [
    paddingMap[padding],
    "rounded-[12px] overflow-hidden",
    interactive && "cursor-pointer transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-[#FF6B4A]/30",
    loading && "relative pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {children}
      {loading && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-white/40 backdrop-blur-sm animate-pulse rounded-[12px]"
        />
      )}
    </>
  );

  // Design-Lab-tagged mode: GlassCard supplies the surface (variant class
  // + data-glass-* attributes); the Card keeps padding/radius/behaviour.
  if (glassId) {
    return (
      <GlassCard
        glassId={glassId}
        label={glassLabel ?? glassId}
        defaultVariant={glassDefault ?? "v03"}
        className={sharedClasses}
        {...rest}
      >
        {inner}
      </GlassCard>
    );
  }

  return (
    <div ref={ref} className={`${variantMap[variant]} ${sharedClasses}`.trim()} {...rest}>
      {inner}
    </div>
  );
});
