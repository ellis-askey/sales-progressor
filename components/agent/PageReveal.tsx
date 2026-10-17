"use client";

// Content entrance for agent pages — the universal load-in bloom (2026-10-18,
// Loading & Entrance Studio). Lives INSIDE the page (below the Suspense
// boundary) so it mounts when the real content mounts, not while the quiet
// loading fallback shows. Wraps the body in .agent-bloom-stagger: direct
// children bloom (blur 12px + rise 32px → clear, 520ms snappy) in a 50ms
// cascade. Pure CSS, runs after paint, reduced-motion disables it.

export function PageReveal({ children }: { children: React.ReactNode }) {
  return <div className="agent-bloom-stagger">{children}</div>;
}
