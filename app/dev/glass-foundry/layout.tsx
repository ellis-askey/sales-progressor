// /dev/glass-foundry — isolated optical laboratory (Phase 1). Dev-only (page gates
// in prod). Self-contained: LiquidLens / refraction-map / spring / liquid-glass.css
// are used READ-ONLY; every experimental material treatment is local to this route.
// Nothing shared, global, documented, or production is changed. Nothing is Approved.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function GlassFoundryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
