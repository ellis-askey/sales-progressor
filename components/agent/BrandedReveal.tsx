// Analytics content entrance. Now just the universal bloom (2026-10-18) — the
// branded loader + crossfade was retired in the load-in sweep. Kept as a thin
// wrapper so the Analytics page's import site is unchanged; the whole app now
// shares one entrance (.agent-bloom in agent-system.css).

export function BrandedReveal({ children }: { children: React.ReactNode }) {
  return <div className="agent-bloom">{children}</div>;
}
