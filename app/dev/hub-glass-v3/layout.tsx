// /dev/hub-glass-v3 — isolated Hub redesign (B+C hybrid, approved direction).
// Dev-only (page gates in prod). Presentation-only; mock/read-only data; every
// action simulated (no writes). Keeps /dev/updates-glass, v1, v2 and production
// untouched.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function HubGlassV3Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
