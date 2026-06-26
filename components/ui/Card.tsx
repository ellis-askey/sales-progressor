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
  children?: ReactNode;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = "glass",
    padding = "md",
    interactive = false,
    loading = false,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const baseClasses = [
    variantMap[variant],
    paddingMap[padding],
    "rounded-[12px] overflow-hidden",
    interactive && "cursor-pointer transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-[#FF6B4A]/30",
    loading && "relative pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={baseClasses} {...rest}>
      {children}
      {loading && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-white/40 backdrop-blur-sm animate-pulse rounded-[12px]"
        />
      )}
    </div>
  );
});
