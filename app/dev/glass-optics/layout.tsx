// /dev/glass-optics — side-by-side comparison of the current LiquidGlass engine
// vs the experimental LiquidLens (slab optics). Dev-only (page gates in prod).

import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";

export default function GlassOpticsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
