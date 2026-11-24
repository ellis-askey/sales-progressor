// /dev/glass-lab — interaction laboratory for TSP Liquid Glass. Dev-only.
// Six genuinely-interactive glass controls on Radix primitives + the LiquidGlass
// material + adapted Glassy UI spring physics. Page gates in production.

import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";

export default function GlassLabLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
