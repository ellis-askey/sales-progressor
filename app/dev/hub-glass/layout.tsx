// /dev/hub-glass — isolated Hub redesign prototype. Dev-only (page gates in prod).
// Presentation-only; mock/read-only data; every action simulated (no writes).
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function HubGlassLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
