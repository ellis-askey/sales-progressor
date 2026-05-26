"use client";

// Tiny client wrapper that gives its children auto-animate behaviour.
// Used on the hub to make sibling cards (ExpiredHoldsCard, AttentionList,
// UnassignedFiles) smoothly shift up when one of them collapses to empty
// (e.g. last expired-hold actioned, card removes itself by returning null).

import { useAutoAnimate } from "@formkit/auto-animate/react";

export function AnimatedSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const [ref] = useAutoAnimate<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {children}
    </div>
  );
}
