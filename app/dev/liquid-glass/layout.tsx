// /dev/liquid-glass layout — standalone. Deliberately NOT wired to the TSP agent
// token environment: this is a generic Apple "Liquid Glass" showcase, so it brings
// its own font stack, accent palette and wallpaper (all in page.tsx). Dev-only
// (page.tsx blocks in production).

import type { ReactNode } from "react";

export default function LiquidGlassDevLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
