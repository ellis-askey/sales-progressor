// /dev/design-system — TSP Liquid Glass showroom. Standalone dev route.
// Imports the scoped kit stylesheet (only dev routes load it, so no global impact).
// Page gates in production.

import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
