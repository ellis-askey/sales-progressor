// Quiet route-level loading fallbacks (2026-10-18 load-in bloom). Skeletons
// retired app-wide: navigation commits immediately, the page TITLE paints in
// place, and the body stays calm and empty until the real content blooms in
// (.agent-bloom-stagger). See docs/reference/MOTION_GUIDE.md "Content load-in".
// Signatures are unchanged so every existing loading.tsx keeps compiling; the
// body-shape props (variant/rows) are now ignored.

import { PageHeader } from "@/components/layout/PageHeader";

// A card-shaped slot's fallback: just reserves its height so the layout doesn't
// jump, then the real section blooms in. No silhouette bars.
export function SectionSkeleton({
  minHeight = 140,
  label,
}: {
  minHeight?: number;
  rows?: number;
  // Announced to screen readers; sighted users just see the space fill.
  label?: string;
}) {
  return (
    <div aria-hidden={label ? undefined : "true"} style={{ minHeight }}>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

// Full route-level fallback for the rail destinations: the page's REAL title
// (static per route) paints instantly so landing feels like arriving, then the
// body blooms in. No skeleton body.
export function RailPageSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  variant?: "list" | "cards" | "table";
  rows?: number;
}) {
  return <PageHeader title={title} subtitle={subtitle ?? " "} />;
}
