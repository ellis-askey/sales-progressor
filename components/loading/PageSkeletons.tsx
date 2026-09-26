// Page- and section-shaped loading silhouettes (instant-shell slice,
// 2026-09-18). These replace the LoadingCard dots/spinner treatment on agent
// surfaces: navigation commits to the destination immediately, the page's
// shape appears in place, and real content swaps in as it arrives. Built on
// the canonical Skeleton primitive (components/ui/Skeleton.tsx) — same
// contract as components/transaction/PanelSkeletons.tsx, generalised for
// route-level fallbacks. Server-safe (no client hooks).

import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

function Bar({ width, height = 13, mt = 0 }: { width: string | number; height?: number; mt?: number }) {
  return (
    <Skeleton
      variant="block"
      width={width}
      height={height}
      style={{ borderRadius: 6, marginTop: mt, display: "block" }}
    />
  );
}

// One glass section in silhouette: a title bar plus a few content rows.
// Used as the Suspense fallback for hub sections and any card-shaped slot.
export function SectionSkeleton({
  minHeight = 140,
  rows = 3,
  label,
}: {
  minHeight?: number;
  rows?: number;
  // Announced to screen readers only — sighted users read the shape.
  label?: string;
}) {
  return (
    <div
      className="glass-v05"
      style={{
        borderRadius: "var(--agent-radius-xl)",
        padding: "18px 22px",
        minHeight,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {label && <span className="sr-only">{label}</span>}
      <Bar width="30%" height={15} />
      {Array.from({ length: rows }).map((_, i) => (
        <Bar key={i} width={`${78 - i * 9}%`} height={12} />
      ))}
    </div>
  );
}

// Full route-level fallback for the rail destinations. Renders the page's
// REAL title (static and known per route) so landing feels like arriving on
// the page, plus a body silhouette in the page's rough shape.
export function RailPageSkeleton({
  title,
  subtitle,
  variant = "list",
  rows = 6,
}: {
  title: string;
  subtitle?: string;
  variant?: "list" | "cards" | "table";
  rows?: number;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle ?? " "} />
      {/* Body carries the same entrance as the real content (PageReveal) so the
          skeleton→content swap reads as one continuous fade. Header stays put. */}
      <div className="px-4 md:px-8 py-2 md:py-4 page-fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {variant === "cards" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
              <SectionSkeleton key={i} minHeight={150} rows={3} />
            ))}
          </div>
        ) : variant === "table" ? (
          <div
            className="glass-v05"
            style={{ borderRadius: "var(--agent-radius-xl)", padding: "6px 22px", display: "flex", flexDirection: "column" }}
          >
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "13px 0",
                  borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-default)",
                }}
              >
                <Bar width="26%" height={13} />
                <Bar width="14%" height={11} />
                <Bar width="10%" height={11} />
                <span style={{ marginLeft: "auto" }}>
                  <Bar width={64} height={11} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="glass-v05"
            style={{ borderRadius: "var(--agent-radius-xl)", padding: "6px 22px", display: "flex", flexDirection: "column" }}
          >
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  padding: "13px 0",
                  borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-default)",
                }}
              >
                <Bar width={`${62 - i * 5}%`} height={13} />
                <Bar width="34%" height={11} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
