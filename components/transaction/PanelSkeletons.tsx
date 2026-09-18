// Shared skeleton placeholders for the file-detail page's Suspense
// boundaries. Each one renders the rough silhouette of its target
// content so the page doesn't flash empty regions while panels stream.
//
// Bespoke domain composer per Skeleton.tsx's own contract — encodes
// panel-grid layout knowledge that isn't a primitive concern. Wraps
// the canonical Skeleton primitive for individual pulse rows.

import React from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

function Bar({ width, height = 14, mt = 0 }: { width: string | number; height?: number; mt?: number }) {
  return (
    <Skeleton
      variant="block"
      width={width}
      height={height}
      style={{ borderRadius: 6, marginTop: mt, display: "block" }}
    />
  );
}

export function SidebarPanelSkeleton() {
  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <Bar width="60%" height={14} />
      <Bar width="40%" height={22} />
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Bar width={60} height={60} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Bar width="80%" />
          <Bar width="50%" />
        </div>
      </div>
      <Bar width="100%" height={1} mt={8} />
      <Bar width="70%" />
      <Bar width="55%" />
      <Bar width="100%" height={1} mt={8} />
      <Bar width="80%" />
      <Bar width="60%" />
    </div>
  );
}

// Route-level silhouette for the whole file page (Phase 3 perceived-
// performance, 2026-09-18, PERF-06). Replaces the old full-viewport
// LoadingCard bubble in app/agent/transactions/[id]/loading.tsx: opening a
// file now paints the file's shape — hero, tab strip, content cards —
// instead of replacing the app with a spinner card. This is deliberately
// the ONLY route-level fallback kept in the agent app; the blank loaders
// elsewhere were removed so the previous page stays visible during
// navigation. Keeping this one means property → property navigation swaps
// through the skeleton, so the URL and the on-screen file are never out of
// step (no "showing property A under property B's URL").
export function FilePageSkeleton() {
  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8" style={{ minHeight: "100vh" }}>
      {/* Hero: address line, meta line, progress strip */}
      <Card padding="none" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <Bar width="45%" height={20} />
        <Bar width="30%" height={12} />
        <Bar width="100%" height={8} mt={10} />
      </Card>
      {/* Tab strip */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0", overflow: "hidden" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="block" width={78} height={28} style={{ borderRadius: 999, flexShrink: 0 }} />
        ))}
      </div>
      {/* Content cards — single column so it never overflows on mobile;
          the real page's own panel skeletons take over once it streams. */}
      <TabPanelSkeleton rows={3} withHero />
    </div>
  );
}

export function TabPanelSkeleton({ rows = 5, withHero = false }: { rows?: number; withHero?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {withHero && (
        <Card padding="none" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Bar width="40%" height={16} />
          <Bar width="80%" />
        </Card>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <Card
          key={i}
          padding="none"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Bar width="70%" height={14} />
          <Bar width="50%" height={12} />
        </Card>
      ))}
    </div>
  );
}
