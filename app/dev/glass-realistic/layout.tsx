// /dev/glass-realistic — realistic perf isolation (lens vs current vs none; bg on/off). Dev-only.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function GlassRealisticLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
