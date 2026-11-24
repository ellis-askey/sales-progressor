// /dev/hub-glass-v2 — isolated Hub redesign prototype (A+C hybrid). Dev-only
// (page gates in prod). Presentation-only; mock/read-only data; every action is
// simulated (no writes). Keeps /dev/hub-glass and all production pages untouched.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function HubGlassV2Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
