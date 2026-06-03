// Shared skeleton placeholders for the file-detail page's Suspense
// boundaries. Each one renders the rough silhouette of its target
// content so the page doesn't flash empty regions while panels stream.
//
// Visual cue is the existing `agent-skeleton` utility class — already
// used by loading.tsx, so the look matches what the user sees today.

import React from "react";

function Bar({ width, height = 14, mt = 0 }: { width: string | number; height?: number; mt?: number }) {
  return (
    <div
      className="agent-skeleton"
      style={{
        width,
        height,
        borderRadius: 6,
        marginTop: mt,
      }}
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
        <div className="glass-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Bar width="40%" height={16} />
          <Bar width="80%" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="glass-card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Bar width="70%" height={14} />
          <Bar width="50%" height={12} />
        </div>
      ))}
    </div>
  );
}
