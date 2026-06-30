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
