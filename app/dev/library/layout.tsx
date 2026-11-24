// /dev/library — TSP component library showroom. Dev-only (page gates in prod).
// Isolated: shared primitives (LiquidLens, spring, AppBackground, tokens) + Radix
// used READ-ONLY; every library component lives under this route. Nothing shared,
// global, documented, or production is modified. Nothing is Approved.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
